from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    APP_NAME:str="UC02 Prior Authorization Backend"; APP_ENV:str="development"; APP_HOST:str="0.0.0.0"; APP_PORT:int=8000; LOG_LEVEL:str="INFO"; API_PREFIX:str="/api/v1"
    DATABASE_URL:str="postgresql+asyncpg://uc02:uc02_dev_password@localhost:5432/uc02"
    QDRANT_URL:str="http://localhost:6333"; QDRANT_COLLECTION:str="uc02_policy_evidence"
    GEMINI_API_KEY: str = ""
    GEMINI_GENERATION_MODEL: str = "gemini-3.6-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    CORS_ORIGINS:str="http://localhost:3000,http://localhost:5173"
    INFERENCE_SERVICE_URL: str = "http://localhost:8000"
    model_config=SettingsConfigDict(env_file=".env",extra="ignore",case_sensitive=False)
    @property
    def cors_origins_list(self): return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]
@lru_cache
def get_settings(): return Settings()
settings=get_settings()
