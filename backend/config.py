from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int

    BACKEND_URL: str
    FRONTEND_URL: str

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = ""

    FACEBOOK_CLIENT_ID: str
    FACEBOOK_CLIENT_SECRET: str

    INSTAGRAM_CLIENT_ID: str
    INSTAGRAM_CLIENT_SECRET: str

    DATABASE_URL: str

    OPENROUTER_API_KEY: str
    OPENROUTER_WEEKLY_SUMMARY_MODEL: str
    OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS: str

    CORS_ALLOW_ORIGINS: str = ""

    model_config = SettingsConfigDict(env_file=".env")


# BaseSettings pulls required values from env/.env at runtime.
# Pyright cannot infer that and incorrectly flags missing constructor args.
settings = Settings()  # pyright: ignore[reportCallIssue]
