"""ASGI entry point for deployment (uvicorn main:app)."""
from app import app

__all__ = ["app"]
