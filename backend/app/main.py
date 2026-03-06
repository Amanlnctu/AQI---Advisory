from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import Database
from app.api import endpoints

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Events
    await Database.connect_db()
    
    # Could initialize background tasks like APScheduler here
    # scheduler = AsyncIOScheduler()
    # scheduler.add_job(fetch_hourly_data, 'interval', hours=1)
    # scheduler.start()

    yield
    
    # Shutdown Events
    await Database.close_db()

app = FastAPI(
    title=settings.app_name,
    description="API for forecasting Air Quality Index (AQI) and providing personalized health advisories.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware MUST be enabled for all origins based on requirements
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api/v1")
