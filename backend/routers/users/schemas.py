from pydantic import BaseModel


class RegisterUserRequest(BaseModel):
    username: str
    password: str
    email: str | None = None
    display_name: str | None = None


class RegisterUserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    display_name: str | None = None


class UpdateMeRequest(BaseModel):
    email: str | None = None
    display_name: str | None = None
