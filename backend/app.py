"""FastAPI application with collaborative lists support."""
# Force UTF-8 encoding for Windows compatibility
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Load environment variables FIRST, before any other imports
from dotenv import load_dotenv
load_dotenv()

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from routes import router
from utils.allowlist import get_email_from_token, is_email_allowed
from utils.terms_guard import check_terms_and_age

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="GetawayGather - Collaborative Lists")


class TermsGuardMiddleware(BaseHTTPMiddleware):
    """Block /api/* access for users who haven't accepted terms (after TERMS_UPDATED_AT) or verified age."""

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        if request.url.path == "/api/check-access":
            return await call_next(request)

        auth = request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return await call_next(request)

        token = auth.split(maxsplit=1)[1]
        ok, error_code = check_terms_and_age(token)
        if not ok:
            return JSONResponse(
                status_code=403,
                content={"detail": error_code, "code": error_code},
            )
        return await call_next(request)


class AllowlistMiddleware(BaseHTTPMiddleware):
    """Block /api/* access for users not in ALLOWED_EMAILS (when set)."""

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        auth = request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return await call_next(request)

        token = auth.split(maxsplit=1)[1]
        email = get_email_from_token(token)
        if not is_email_allowed(email):
            return JSONResponse(
                status_code=403,
                content={"detail": "not_on_allowlist", "code": "NOT_ON_ALLOWLIST"},
            )
        return await call_next(request)


# Terms guard and allowlist run after CORS (middleware order: last added = first to run)
app.add_middleware(AllowlistMiddleware)
app.add_middleware(TermsGuardMiddleware)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

SITE_DIR = Path(__file__).resolve().parent / "site"
SITE_DIR.mkdir(parents=True, exist_ok=True)

# Static files (e.g. index.html if present)
app.mount("/static", StaticFiles(directory=str(SITE_DIR)), name="static")


@app.get("/")
async def index():
    """Serve index page."""
    return FileResponse(SITE_DIR / "index.html")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
