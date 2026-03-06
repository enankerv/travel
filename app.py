import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

from scout import generate_villa_page, generate_villa_page_from_paste

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Nankervis Scout")

SITE_DIR = Path(__file__).resolve().parent / "site"
VILLAS_DIR = SITE_DIR / "villas"
IMAGES_DIR = SITE_DIR / "images"


class ScoutRequest(BaseModel):
    url: HttpUrl
    check_in: str | None = None
    check_out: str | None = None
    guests: int | None = None


class ScoutPasteRequest(BaseModel):
    pasted_text: str
    original_url: str | None = None


class ScoutResponse(BaseModel):
    ok: bool
    path: str | None = None
    error: str | None = None
    thin_scrape: bool = False


@app.post("/api/scout", response_model=ScoutResponse)
async def scout_listing(req: ScoutRequest):
    url = str(req.url)
    try:
        result = await generate_villa_page(
            url,
            check_in=req.check_in,
            check_out=req.check_out,
            guests=req.guests,
        )
        return ScoutResponse(
            ok=True,
            path=result.get("path"),
            thin_scrape=result.get("thin_scrape", False),
        )
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))


@app.post("/api/scout-paste", response_model=ScoutResponse)
async def scout_from_paste(req: ScoutPasteRequest):
    """Build a villa report from pasted listing text (e.g. when scrape fails for Airbnb)."""
    try:
        path = await generate_villa_page_from_paste(
            pasted_text=req.pasted_text,
            original_url=req.original_url,
        )
        return ScoutResponse(ok=True, path=path)
    except Exception as e:
        return ScoutResponse(ok=False, error=str(e))


@app.get("/api/villas")
async def list_villas():
    if not VILLAS_DIR.exists():
        return {"villas": []}
    villas = []
    for f in sorted(VILLAS_DIR.glob("*.html"), key=lambda p: p.stat().st_mtime, reverse=True):
        villas.append({"path": f"/villas/{f.name}", "slug": f.stem})
    return {"villas": villas}


# Static files (generated villa pages + images)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/villas", StaticFiles(directory=str(VILLAS_DIR), html=True), name="villas")


@app.get("/")
async def index():
    return FileResponse(SITE_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
