from pydantic import BaseModel, Field


class SendMessageRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    message: str = Field(min_length=1, max_length=5000)
