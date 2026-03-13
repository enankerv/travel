"""API routes - split by resource."""
from fastapi import APIRouter

from routes.auth import router as auth_router
from routes.lists import router as lists_router
from routes.members import router as members_router
from routes.invites import router as invites_router
from routes.getaways import router as getaways_router
from routes.scout import router as scout_router

router = APIRouter(prefix="/api", tags=["api"])
router.include_router(auth_router)
router.include_router(lists_router)
router.include_router(members_router)
router.include_router(invites_router)
router.include_router(getaways_router)
router.include_router(scout_router)
