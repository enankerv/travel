"""Stripe client for credit pack checkout and webhook verification."""
import os
import stripe


class StripeCheckoutError(Exception):
    """Raised when Stripe checkout fails. Message is safe to show to client."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def create_checkout_session(
    *,
    pack_name: str,
    pack_description: str,
    price_cents: int,
    success_url: str,
    cancel_url: str,
    metadata: dict,
) -> str:
    """Create a Stripe Checkout session. Returns checkout URL. Raises StripeCheckoutError on failure."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            automatic_tax={"enabled": True},
            customer_creation="always",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": pack_name,
                            "description": pack_description,
                            "images": [],
                        },
                        "unit_amount": price_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        return session.url
    except stripe.error.StripeError as e:
        raise StripeCheckoutError(str(e))


def verify_webhook(payload: bytes, sig_header: str, webhook_secret: str) -> dict:
    """Verify Stripe webhook signature and return the event."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    return stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
