from pydantic import BaseModel, Field


class RegisterUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)
    email: str = Field(min_length=3, max_length=254)
    display_name: str | None = Field(default=None, max_length=100)


class RegisterUserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    email_verification_required: bool = True
    message: str = "Verify your email before logging in"


class UpdateMeRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    display_name: str | None = Field(default=None, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class SetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class ResendVerificationEmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class VerifyEmailCodeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    code: str = Field(min_length=4, max_length=12)


class VerificationEmailResponse(BaseModel):
    message: str


class VerifyEmailResponse(BaseModel):
    message: str
    email_verified: bool = True
