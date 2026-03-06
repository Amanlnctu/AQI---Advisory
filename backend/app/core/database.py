from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    async def connect_to_mongo(cls):
        try:
            logger.info("Connecting to MongoDB...")
            cls.client = AsyncIOMotorClient(settings.mongodb_url)
            cls.db = cls.client[settings.mongo_db_name]
            logger.info("Successfully connected to MongoDB.")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    @classmethod
    async def close_mongo_connection(cls):
        if cls.client:
            logger.info("Closing MongoDB connection...")
            cls.client.close()
            logger.info("MongoDB connection closed.")

db_manager = DatabaseManager()

def get_db():
    """Dependency injection helper to return the active database instance."""
    return db_manager.db
