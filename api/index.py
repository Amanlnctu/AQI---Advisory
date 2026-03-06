"""
Vercel serverless entrypoint.
Mangum wraps the FastAPI ASGI app to work as an AWS Lambda / Vercel function handler.

The backend source lives in ../backend/app, which we add to sys.path
so all existing imports (app.core, app.services, app.models, etc.) continue to work.
"""
import sys
import os

# Make backend/ importable from this api/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from mangum import Mangum
from app.main import app  # FastAPI app

# Mangum converts ASGI → WSGI-style handler Vercel (and AWS Lambda) can call
handler = Mangum(app, lifespan="off")
