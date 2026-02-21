from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    name: str
    email: str
    message: str
