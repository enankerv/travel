"""Pydantic models for FastAPI endpoints."""
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, PrivateAttr
from typing import ClassVar, Literal, NamedTuple, Optional


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
    profile: Optional[dict] = None


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
# PROFILE MODELS
# ============================================================================

class Profile(BaseModel):
    """User display profile (first name + avatar)."""

    id: str
    first_name: Optional[str] = None
    avatar_url: Optional[str] = None

    @classmethod
    def get(cls, user_id: str, auth_token: str) -> Optional["Profile"]:
        """Fetch one profile by user id."""
        return cls.for_user_ids([user_id], auth_token).get(str(user_id))

    @classmethod
    def for_user_ids(cls, user_ids: list[str], auth_token: str) -> dict[str, "Profile"]:
        """Batch-fetch profiles. Returns { user_id: Profile }."""
        from db.profiles import fetch_profiles

        unique = list({str(uid) for uid in user_ids if uid})
        return {str(r["id"]): cls.model_validate(r) for r in fetch_profiles(unique, auth_token)}

    @classmethod
    def enrich_rows(
        cls,
        rows: list[dict],
        profiles: dict[str, "Profile"],
        *,
        user_id_field: str = "user_id",
    ) -> None:
        """Attach ``first_name`` and ``avatar_url`` from a profile map onto row dicts."""
        for row in rows:
            p = profiles.get(str(row[user_id_field]))
            row["first_name"] = p.first_name if p else None
            row["avatar_url"] = p.avatar_url if p else None

    def member_dict(self) -> dict:
        """Profile fields embedded on list members (excludes id)."""
        return {"first_name": self.first_name, "avatar_url": self.avatar_url}


# ============================================================================
# POI RELATED DATA (shared across every POI subtype)
# ============================================================================

class Vote(BaseModel):
    """A single vote on a POI, enriched with the voter's profile."""

    poi_id: str
    user_id: str
    first_name: Optional[str] = None
    avatar_url: Optional[str] = None


class Comment(BaseModel):
    """A single comment on a POI, enriched with the author's profile."""

    id: str
    poi_id: str
    user_id: str
    body: str
    created_at: str
    updated_at: str
    first_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ============================================================================
# POI MODELS (spine shared by every board pin)
# ============================================================================

PoiType = Literal["getaway", "activity", "restaurant", "flight", "note", "poi"]


class POIBase(BaseModel):
    """Fields shared by every point of interest / board pin (the pois spine)."""

    poi_type: PoiType = "poi"
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    board_x: float = 0.5
    board_y: float = 0.5
    board_z: int = 0
    subgroup_id: Optional[str] = None


_BOARD_ONLY_FIELDS = frozenset({"board_x", "board_y", "board_z", "subgroup_id"})


class PoiPersistResult(NamedTuple):
    poi: Optional["POI"]
    status: Literal["ok", "not_found"]


class POI(POIBase):
    """The single POI model: spine fields (composed on fetch) plus behavior.

    When fetched or created via ``get`` / ``for_list`` / ``new``, the caller's
    ``auth_token`` is stored on the instance (never serialized to clients) so
    subsequent instance methods and classmethods that receive the instance do
    not need the token passed again.

    CRUD lives here as classmethods:

    * ``get`` / ``for_list`` — query params + token (token stored on result),
    * ``new`` — creation fields + token (token stored on result),
    * ``update`` / ``delete`` — take a fetched instance
      (uses its bound token),
    * ``update_by_id`` / ``delete_by_id`` — take
      an id + explicit token (for scout/background paths that only hold an id).

    Subtypes (Getaway, ...) inherit these hooks and may override ``_subtype_columns``
    etc. Names prefixed with ``_`` are protected — for use inside the POI hierarchy
    only, not part of the public API routes and callers should use.
    """

    model_config = ConfigDict(extra="ignore")

    # Persistence config (subtypes override). ClassVar so Pydantic ignores them.
    _SUBTYPE_TABLE: ClassVar[Optional[str]] = None
    _TYPE_FILTER: ClassVar[Optional[str]] = None
    _IMMUTABLE: ClassVar[frozenset[str]] = frozenset(
        {"id", "list_id", "user_id", "poi_type", "created_at", "updated_at", "images"}
    )

    id: str
    list_id: str
    user_id: Optional[str] = None
    created_at: str
    updated_at: str
    images: list[str] = Field(default_factory=list)

    # Session auth for RLS-scoped db calls. Set on every get/for_list/new; never serialized.
    _auth_token: str = PrivateAttr()

    # ---- protected hooks (POI hierarchy only; subtypes may override) --------
    @classmethod
    def _spine_columns(cls) -> set[str]:
        return set(POIBase.model_fields)

    @classmethod
    def _subtype_columns(cls) -> set[str]:
        return set()

    @classmethod
    def _split_writable(cls, data: dict) -> tuple[dict, dict]:
        spine = {
            k: v for k, v in data.items()
            if k in cls._spine_columns() and k not in cls._IMMUTABLE
        }
        sub = {k: v for k, v in data.items() if k in cls._subtype_columns()}
        return spine, sub

    def _bind_auth_token(self, auth_token: str) -> None:
        object.__setattr__(self, "_auth_token", auth_token)

    def _session_token(self) -> str:
        try:
            return self._auth_token
        except AttributeError as e:
            raise RuntimeError(
                "POI has no session token — fetch or create via get/for_list/new first"
            ) from e

    @classmethod
    def _persist_update(
        cls,
        poi_id: str,
        auth_token: str,
        model_cls: type["POI"],
        changes: dict,
        *,
        list_id: str | None = None,
    ) -> PoiPersistResult:
        from db.pois import update_poi_row, update_subtype_row
        from routes.auth import extract_user_id_from_token
        from utils.geocode import geocode, geocode_query_for_poi_fields, location_query_if_changed

        user_id: str | None = None
        try:
            user_id = extract_user_id_from_token(auth_token)
        except Exception:
            pass

        if user_id and ("location" in changes or "region" in changes or "address" in changes):
            lat_manual = "lat" in changes and changes.get("lat") is not None
            lng_manual = "lng" in changes and changes.get("lng") is not None
            if not lat_manual and not lng_manual:
                current = model_cls.get(poi_id, auth_token)
                if current:
                    q = None
                    if "address" in changes:
                        q = geocode_query_for_poi_fields({
                            "address": changes.get("address"),
                            "location": changes.get("location", current.location),
                        })
                    if not q:
                        q = location_query_if_changed(
                            current_location=current.location,
                            current_region=getattr(current, "region", None),
                            changes=changes,
                        )
                    if q:
                        lat, lng = geocode(q, user_id=user_id)
                        changes["lat"] = lat
                        changes["lng"] = lng

        spine, sub = model_cls._split_writable(changes)
        board_only = not sub and set(changes.keys()) <= _BOARD_ONLY_FIELDS

        if spine:
            row = update_poi_row(poi_id, spine, auth_token, list_id=list_id)
            if list_id is not None and not row:
                return PoiPersistResult(None, "not_found")
        if sub and model_cls._SUBTYPE_TABLE:
            update_subtype_row(model_cls._SUBTYPE_TABLE, poi_id, sub, auth_token)
        if board_only:
            return PoiPersistResult(None, "ok")
        poi = model_cls.get(poi_id, auth_token)
        return PoiPersistResult(poi, "ok" if poi else "not_found")

    # ---- reads (query params) ---------------------------------------------
    @classmethod
    def get(cls, poi_id: str, auth_token: str) -> Optional["POI"]:
        """Fetch one POI by id. Token is stored on the returned instance."""
        from db.pois import fetch_poi_row
        row = fetch_poi_row(poi_id, auth_token)
        if not row:
            return None
        obj = poi_from_row(row, auth_token)
        if cls is POI:
            return obj
        return obj if isinstance(obj, cls) else None

    @classmethod
    def for_list(
        cls, list_id: str, auth_token: str, *, poi_type: str | None = None,
    ) -> list["POI"]:
        """Fetch POIs in a list. Token is stored on each instance.

        Optional ``poi_type`` filters the query (spine ``poi_type`` column).
        When omitted, uses ``cls._TYPE_FILTER`` (``None`` on base ``POI`` = all types).
        """
        from db.pois import fetch_list_poi_rows
        type_filter = poi_type if poi_type is not None else cls._TYPE_FILTER
        rows = fetch_list_poi_rows(list_id, auth_token, poi_type=type_filter)
        return [poi_from_row(r, auth_token) for r in rows]

    # ---- create -----------------------------------------------------------
    @classmethod
    def new(cls, list_id: str, auth_token: str, *, user_id: Optional[str] = None, **fields) -> Optional["POI"]:
        """Create a POI (+ subtype row). Token is stored on the returned instance."""
        from db.pois import insert_poi_row, insert_subtype_row
        from utils.geocode import geocode, geocode_query_for_poi_fields

        if (
            user_id
            and fields.get("lat") is None
            and fields.get("lng") is None
        ):
            q = geocode_query_for_poi_fields(fields)
            if q:
                lat, lng = geocode(q, user_id=user_id)
                if lat is not None and lng is not None:
                    fields["lat"] = lat
                    fields["lng"] = lng
        spine, sub = cls._split_writable(fields)
        if cls._SUBTYPE_TABLE is not None:
            spine["poi_type"] = cls.model_fields["poi_type"].default
        else:
            spine["poi_type"] = fields.get("poi_type") or cls.model_fields["poi_type"].default
        row = insert_poi_row(list_id, spine, auth_token, user_id=user_id)
        if not row:
            return None
        if cls._SUBTYPE_TABLE:
            insert_subtype_row(cls._SUBTYPE_TABLE, row["id"], sub, auth_token)
        return cls.get(row["id"], auth_token)

    # ---- update / delete (instance — uses bound token) --------------------
    @classmethod
    def update(cls, poi: "POI", **changes) -> Optional["POI"]:
        """Apply ``changes`` to a fetched instance; uses its bound auth token."""
        return cls._persist_update(
            poi.id, poi._session_token(), type(poi), changes,
        ).poi

    @classmethod
    def delete(cls, poi: "POI") -> bool:
        """Delete a fetched instance; uses its bound auth token."""
        from db.pois import delete_poi_row
        return delete_poi_row(poi.id, poi._session_token())

    # ---- update / delete (id + token — scout / background paths) ----------
    @classmethod
    def update_by_id(
        cls, poi_id: str, auth_token: str, *, list_id: str | None = None, **changes
    ) -> PoiPersistResult:
        """Apply ``changes`` by poi id with an explicit auth token."""
        return cls._persist_update(
            poi_id, auth_token, cls, changes, list_id=list_id,
        )

    @classmethod
    def delete_by_id(
        cls, poi_id: str, auth_token: str, *, list_id: str | None = None,
    ) -> bool:
        """Delete by poi id with an explicit auth token."""
        from db.pois import delete_poi_row
        return delete_poi_row(poi_id, auth_token, list_id=list_id)

    # ---- related data (uses bound token) ----------------------------------
    def votes(self) -> list["Vote"]:
        from db.votes import get_votes_for_poi
        return [Vote(**v) for v in get_votes_for_poi(self.id, self._session_token())]

    def comments(self) -> list["Comment"]:
        from db.comments import get_comments_for_poi
        return [Comment(**c) for c in get_comments_for_poi(self.id, self._session_token())]

    def add_vote(self, user_id: str) -> Optional["Vote"]:
        from db.votes import add_vote
        row = add_vote(self.id, user_id, self._session_token())
        return Vote(**row) if row else None

    def remove_vote(self, user_id: str) -> bool:
        from db.votes import remove_vote
        return remove_vote(self.id, user_id, self._session_token())

    def add_comment(self, user_id: str, body: str) -> Optional["Comment"]:
        from db.comments import create_comment
        row = create_comment(self.id, user_id, body, self._session_token())
        return Comment(**row) if row else None


# ============================================================================
# GETAWAY MODELS (accommodation subtype of POI)
# ============================================================================

class GetawayFields(BaseModel):
    """Accommodation-specific fields stored in the getaways subtype table."""

    import_status: Literal["loading", "loaded", "thin", "error"] = "loading"
    import_error: Optional[str] = None
    region: Optional[str] = None
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
    caveats: Optional[str] = None


class Getaway(POI, GetawayFields):
    """A getaway *is* a POI (spine + behavior) plus accommodation fields."""

    poi_type: Literal["getaway"] = "getaway"

    _SUBTYPE_TABLE: ClassVar[Optional[str]] = "getaways"
    _TYPE_FILTER: ClassVar[Optional[str]] = "getaway"

    @classmethod
    def _subtype_columns(cls) -> set[str]:
        return set(GetawayFields.model_fields)

    class Update(BaseModel):
        """HTTP input contract for the listing editor — *not* the full entity.

        Whitelists the fields a client may PATCH/PUT and ignores everything else
        (``import_status``, ``id``, ``images``, etc. are not editable here).
        The domain model's ``update`` routes these fields to the correct table.
        """

        model_config = ConfigDict(extra="ignore")

        title: Optional[str] = None
        location: Optional[str] = None
        region: Optional[str] = None
        bedrooms: Optional[int] = None
        bathrooms: Optional[int] = None
        max_guests: Optional[int] = None
        price: Optional[float] = None
        price_currency: Optional[str] = None
        price_period: Optional[str] = None
        amenities: Optional[list[str]] = None
        included: Optional[list[str]] = None
        description: Optional[str] = None
        caveats: Optional[str] = None


# Back-compat alias for imports that haven't moved to Getaway.Update yet.
GetawayEditorUpdate = Getaway.Update


class POIUpdateResponse(BaseModel):
    ok: bool
    poi: Optional[POI] = None


class POICreate(BaseModel):
    """HTTP body for creating a spine-only POI (no subtype fields)."""

    model_config = ConfigDict(extra="ignore")

    poi_type: PoiType = "poi"
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    board_x: Optional[float] = None
    board_y: Optional[float] = None
    board_z: Optional[int] = None
    subgroup_id: Optional[str] = None


class POIUpdate(BaseModel):
    """HTTP body for updating spine fields on any POI."""

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    board_x: Optional[float] = None
    board_y: Optional[float] = None
    board_z: Optional[int] = None
    subgroup_id: Optional[str] = None


class PoiBoardPosition(BaseModel):
    id: str
    board_x: float = Field(ge=0, le=1)
    board_y: float = Field(ge=0, le=1)
    subgroup_id: Optional[str] = None


class BulkPoiPositionsUpdate(BaseModel):
    positions: list[PoiBoardPosition] = Field(min_length=1)


class BulkPoiPositionsResponse(BaseModel):
    ok: bool = True
    updated: int


class BoardChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class BoardChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[BoardChatMessage] = Field(default_factory=list, max_length=50)


class BoardChatSource(BaseModel):
    title: str
    uri: str


class BoardChatPoiSuggestion(BaseModel):
    poi_type: Literal["activity", "restaurant", "flight", "poi"] = "poi"
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: str = Field(min_length=1)
    thumbnail_url: Optional[str] = None


class BoardChatResponse(BaseModel):
    reply: str
    sources: list[BoardChatSource] = Field(default_factory=list)
    suggestions: list[BoardChatPoiSuggestion] = Field(default_factory=list)


class BoardPoi(POI):
    """POI snapshot for the cork board, with nested comments and votes."""

    model_config = ConfigDict(extra="allow")

    comments: list[Comment] = Field(default_factory=list)
    votes: list[Vote] = Field(default_factory=list)


class BoardResponse(BaseModel):
    list: ListResponse
    members: list[ListMember]
    subgroups: list["BoardSubgroup"] = Field(default_factory=list)
    pois: list[BoardPoi]

    @classmethod
    def snapshot(cls, list_id: str, auth_token: str) -> Optional["BoardResponse"]:
        """Load the full cork-board payload for a list."""
        from db.board import fetch_board_snapshot
        return fetch_board_snapshot(list_id, auth_token)


# ============================================================================
# BOARD SUBGROUP MODELS
# ============================================================================

class BoardSubgroup(BaseModel):
    """Nested frame on the cork board."""

    id: str
    list_id: str
    parent_subgroup_id: Optional[str] = None
    name: str
    board_x: float = Field(ge=0, le=1)
    board_y: float = Field(ge=0, le=1)
    board_w: float = Field(gt=0, le=1)
    board_h: float = Field(gt=0, le=1)
    board_z: int = 0
    created_at: str
    updated_at: str


class BoardSubgroupCreate(BaseModel):
    name: str = Field(min_length=1)
    parent_subgroup_id: Optional[str] = None
    board_x: float = Field(default=0.35, ge=0, le=1)
    board_y: float = Field(default=0.35, ge=0, le=1)
    board_w: float = Field(default=0.3, gt=0, le=1)
    board_h: float = Field(default=0.25, gt=0, le=1)
    board_z: int = 0


class BoardSubgroupUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1)
    parent_subgroup_id: Optional[str] = None
    board_x: Optional[float] = Field(default=None, ge=0, le=1)
    board_y: Optional[float] = Field(default=None, ge=0, le=1)
    board_w: Optional[float] = Field(default=None, gt=0, le=1)
    board_h: Optional[float] = Field(default=None, gt=0, le=1)
    board_z: Optional[int] = None


class BoardSubgroupDeleteResponse(BaseModel):
    ok: bool = True


# Maps pois.poi_type -> concrete model. POI is the fallback for plain pins.
_POI_MODELS: dict[str, type[POI]] = {
    "getaway": Getaway,
}


def poi_class_for_type(poi_type: str) -> type[POI]:
    """Return the domain model class for a ``poi_type`` (``POI`` for spine-only types)."""
    return _POI_MODELS.get(poi_type, POI)


def poi_from_row(row: dict, auth_token: str) -> POI:
    """Build the correct POI subtype from a composed pois row (spine + subtype
    + images). Dispatches on ``poi_type`` and binds the session auth token."""
    model = _POI_MODELS.get(row.get("poi_type") or "poi", POI)
    obj = model.model_validate(row)
    obj._bind_auth_token(auth_token)
    return obj


def board_poi_from_row(
    spine: dict,
    comments: list[dict],
    votes: list[dict],
    auth_token: str,
) -> BoardPoi:
    """Build a board POI from a composed row plus nested comments and votes."""
    poi = poi_from_row(spine, auth_token)
    return BoardPoi.model_validate({
        **poi.model_dump(mode="json"),
        "comments": comments,
        "votes": votes,
    })


# ============================================================================
# SCOUT MODELS
# ============================================================================

class ScoutRequest(BaseModel):
    url: HttpUrl
    list_id: str  # Required: which list to save to
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    guests: Optional[int] = None
    poi_id: Optional[str] = None  # When provided, update this poi instead of creating new (retry)


class ScoutPasteRequest(BaseModel):
    pasted_text: str = Field(...)  # Truncated in backend after cutting, before LLM
    list_id: str  # Required: which list to save to
    original_url: Optional[str] = None
    poi_id: Optional[str] = None  # When provided, update this poi instead of creating new


class ScoutResponse(BaseModel):
    ok: bool
    path: Optional[str] = None
    error: Optional[str] = None
    thin_scrape: bool = False
    poi_id: Optional[str] = None
    truncated: bool = False  # True when pasted text was truncated for length limits


class ScoutPackCheckout(BaseModel):
    pack_id: str
    success_url: str
    cancel_url: str


class GetawayImageUploadFile(BaseModel):
    content_type: str


class GetawayImageUploadUrlsRequest(BaseModel):
    files: list[GetawayImageUploadFile] = Field(..., min_length=1)


class GetawayImageUploadSlot(BaseModel):
    path: str
    token: str
    signed_url: str


class GetawayImageUploadUrlsResponse(BaseModel):
    ok: bool = True
    uploads: list[GetawayImageUploadSlot]


# ============================================================================
# ERROR MODELS
# ============================================================================

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
