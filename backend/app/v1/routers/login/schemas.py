from app.v1.models import Token
from pydantic import BaseModel, Field


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=20, max_length=2048)


__all__ = ["Token", "RefreshTokenRequest"]
