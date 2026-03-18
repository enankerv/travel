"""Scout credit packs: list packs and create Stripe checkout."""
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from config.scout_packs import SCOUT_PACKS
from models import ScoutPackCheckout
from routes.auth import extract_auth_token, extract_user_id_from_token
from utils.stripe_client import StripeCheckoutError, create_checkout_session

router = APIRouter(tags=["scout-packs"])


@router.get("/scout-packs")
async def list_scout_packs():
    """List available credit packs for purchase."""
    return {"packs": SCOUT_PACKS}


@router.post("/scout-packs/checkout")
async def create_checkout(
    req: ScoutPackCheckout,
    authorization: Optional[str] = Header(None),
):
    """Create a Stripe Checkout session for a credit pack. Returns checkout URL."""
    if not os.environ.get("STRIPE_SECRET_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Payments not configured. Set STRIPE_SECRET_KEY.",
        )

    token = extract_auth_token(authorization)
    user_id = extract_user_id_from_token(token)

    pack = next((p for p in SCOUT_PACKS if p["id"] == req.pack_id), None)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    try:
        checkout_url = create_checkout_session(
            pack_name=pack["name"],
            pack_description=pack.get("description", ""),
            price_cents=int(pack["price_usd"] * 100),
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            metadata={
                "user_id": user_id,
                "pack_id": req.pack_id,
                "credits": str(pack["credits"]),
            },
        )
        return {"checkout_url": checkout_url}
    except StripeCheckoutError as e:
        raise HTTPException(status_code=400, detail=e.message)
