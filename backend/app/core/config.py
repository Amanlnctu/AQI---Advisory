from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Predictive AQI & Health Advisory Platform"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "aqi_platform"
    openweather_api_key: str = ""
    aqi_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
