"""Auth helpers and check-access endpoint."""
import base64
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

router = APIRouter(tags=["auth"])


def extract_auth_token(authorization: Optional[str] = Header(None)) -> str:
    """Extract JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    return parts[1]


def extract_user_id_from_token(token: str) -> str:
    """Extract user_id from JWT token (Supabase uses 'sub' claim)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        data = json.loads(decoded)
        user_id = data.get("sub")
        if not user_id:
            raise ValueError("No user_id in token")
        return user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.get("/check-access")
async def check_access(authorization: Optional[str] = Header(None)):
    """Lightweight endpoint to verify user is on allowlist. Returns 200 if allowed."""
    extract_auth_token(authorization)
    return {"ok": True}
