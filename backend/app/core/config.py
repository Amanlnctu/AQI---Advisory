from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Predictive AQI & Health Advisory Platform"
    mongodb_url: str = "mongodb://localhost:27017"
    mongo_db_name: str = "aqi_db"
    openweather_api_key: str = "placeholder_openweather"
    aqi_api_key: str = "placeholder_aqi"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
