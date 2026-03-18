"""Webhooks (e.g. Stripe payment success)."""
import os
import logging
from fastapi import APIRouter, Request, HTTPException, Response

from db.scout_quota import add_credits
from utils.stripe_client import verify_webhook

log = logging.getLogger(__name__)
router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. On checkout.session.completed, add credits."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        log.warning("STRIPE_WEBHOOK_SECRET not set, skipping webhook verification")
        return Response(status_code=200)

    try:
        event = verify_webhook(payload, sig_header, webhook_secret)
    except ValueError as e:
        log.warning("Stripe webhook invalid payload: %s", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as e:
        log.warning("Stripe webhook signature verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        user_id = metadata.get("user_id")
        credits_str = metadata.get("credits")

        if user_id and credits_str:
            try:
                credits = int(credits_str)
                add_credits(user_id, credits)
                log.info("Added %d credits for user %s after Stripe payment", credits, user_id)
            except (ValueError, TypeError) as e:
                log.error("Failed to add credits from webhook: %s", e)
        else:
            log.warning("Stripe webhook missing user_id or credits in metadata: %s", metadata)

    return Response(status_code=200)
