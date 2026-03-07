"""FastAPI application with collaborative lists support."""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from routes import router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="Nankervis Scout - Collaborative Lists")

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
VILLAS_DIR = SITE_DIR / "villas"
IMAGES_DIR = SITE_DIR / "images"

# Create directories if they don't exist
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
VILLAS_DIR.mkdir(parents=True, exist_ok=True)

# Static files
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/villas", StaticFiles(directory=str(VILLAS_DIR), html=True), name="villas")
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
