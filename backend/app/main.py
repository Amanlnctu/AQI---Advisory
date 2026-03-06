from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import DatabaseManager
from app.api import endpoints

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Execute connect functions at app boot
    await DatabaseManager.connect_to_mongo()
    yield
    # Drop cleanly
    await DatabaseManager.close_mongo_connection()

app = FastAPI(
    title=settings.app_name,
    description="Backend API powering the 3 Predictive AQI Application Screens.",
    version="2.0.0",
    lifespan=lifespan
)

# Apply permissive CORS for local dev and Vercel production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vercel handles per-origin restriction via Edge config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api/v1")
