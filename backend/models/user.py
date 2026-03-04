from uuid import UUID

from pydantic import BaseModel


class User(BaseModel):
    username: str
    user_id: UUID | None = None
