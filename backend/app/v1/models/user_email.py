from .user import User


class UserEmail(User):
    email: str | None
    display_name: str | None
