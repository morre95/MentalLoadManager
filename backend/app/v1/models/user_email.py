from .user import User


class UserEmail(User):
    email: str | None
    display_name: str | None
    email_verified: bool = False
    has_password: bool = False
