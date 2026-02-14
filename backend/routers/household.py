from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from helpers import get_current_user, get_session_local
from models import UserEmail, UserDB, UsersHouseholds


router = APIRouter(
    prefix="/api/household",
    tags=["household"],
)


class HouseholdMember(BaseModel):
    user_id: str
    username: str
    email: str | None = None


class HouseholdMembersResponse(BaseModel):
    members: list[HouseholdMember]


@router.get("/members", response_model=HouseholdMembersResponse)
def list_household_members(current_user: UserEmail = Depends(get_current_user)):
    """
    Returns all members in the *same household(s)* as the current user.
    If the user belongs to multiple households, you get the union of members.
    """
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Find household ids for the current user
        household_ids = db.scalars(
            select(UsersHouseholds.household_id).where(UsersHouseholds.user_id == me.user_id)
        ).all()

        if not household_ids:
            return HouseholdMembersResponse(members=[])

        # Get all users in those households
        rows = db.execute(
            select(UserDB.user_id, UserDB.username, UserDB.email)
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id.in_(household_ids))
            .order_by(UserDB.username.asc())
        ).all()

        members = [
            HouseholdMember(
                user_id=str(r.user_id),
                username=r.username,
                email=r.email,
            )
            for r in rows
        ]

        return HouseholdMembersResponse(members=members)
