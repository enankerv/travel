"""Pydantic models for FastAPI endpoints."""
from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal


# ============================================================================
# LIST MODELS
# ============================================================================

class ListCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ListMember(BaseModel):
    user_id: str
    role: Literal["admin", "editor", "viewer"]
    joined_at: Optional[str] = None


class ListResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: str
    updated_at: str
    getaway_count: int = 0
    member_count: int = 0


# ============================================================================
# LIST MEMBER MODELS
# ============================================================================

class AddListMember(BaseModel):
    user_id: str
    role: Literal["admin", "editor", "viewer"] = "viewer"


class UpdateMemberRole(BaseModel):
    role: Literal["admin", "editor", "viewer"]


# ============================================================================
# INVITE MODELS
# ============================================================================

class CreateInvite(BaseModel):
    role: Literal["editor", "viewer"] = "viewer"
    expires_in_days: int = 30
    max_uses: Optional[int] = None


class InviteResponse(BaseModel):
    token: str
    list_id: str
    role: str
    expires_at: Optional[str] = None
    max_uses: Optional[int] = None
    uses_count: int
    is_active: bool


class InviteTokenDetails(BaseModel):
    token: str
    role: str
    list_id: str
    list_name: str
    expires_at: Optional[str] = None
    uses_count: int
    max_uses: Optional[int] = None


class AcceptInvite(BaseModel):
    token: str


# ============================================================================
# GETAWAY MODELS
# ============================================================================

class GetawayData(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    max_guests: Optional[int] = None
    price: Optional[float] = None
    price_currency: Optional[str] = None
    price_period: Optional[str] = None
    price_note: Optional[str] = None
    deposit: Optional[float] = None
    amenities: Optional[list[str]] = None
    included: Optional[list[str]] = None
    description: Optional[str] = None
    caveats: Optional[str] = None
    source_url: Optional[str] = None
    images: Optional[list[str]] = None
    slug: Optional[str] = None


class GetawayResponse(GetawayData):
    id: str
    list_id: str
    user_id: Optional[str] = None
    import_status: Literal["loading", "loaded", "thin", "error"] = "loading"
    import_error: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================================
# SCOUT MODELS
# ============================================================================

class ScoutRequest(BaseModel):
    url: HttpUrl
    list_id: str  # Required: which list to save to
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    guests: Optional[int] = None
    getaway_id: Optional[str] = None  # When provided, update this getaway instead of creating new (retry)


class ScoutPasteRequest(BaseModel):
    pasted_text: str
    list_id: str  # Required: which list to save to
    original_url: Optional[str] = None
    getaway_id: Optional[str] = None  # When provided, update this getaway instead of creating new


class ScoutResponse(BaseModel):
    ok: bool
    path: Optional[str] = None
    error: Optional[str] = None
    thin_scrape: bool = False
    getaway_id: Optional[str] = None


# ============================================================================
# ERROR MODELS
# ============================================================================

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
