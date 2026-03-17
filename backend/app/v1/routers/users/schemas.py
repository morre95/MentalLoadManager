from pydantic import BaseModel, Field


class RegisterUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=254)
    display_name: str | None = Field(default=None, max_length=100)


class RegisterUserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    display_name: str | None = None


class UpdateMeRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    display_name: str | None = Field(default=None, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)
