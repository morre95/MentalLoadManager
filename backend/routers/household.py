from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError

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


class AddHouseholdMemberRequest(BaseModel):
    household_id: UUID
    user_id: UUID | None = None
    username: str | None = None
    email: str | None = None


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


@router.post(
    "/members",
    response_model=HouseholdMember,
    status_code=status.HTTP_201_CREATED,
)
def add_household_member(
    payload: AddHouseholdMemberRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    if not any([payload.user_id, payload.username, payload.email]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One of user_id, username, or email is required",
        )

    username = payload.username.strip() if payload.username else None
    email = payload.email.strip() if payload.email else None

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

        my_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == payload.household_id,
                )
            )
        )
        if my_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        query_conditions = []
        if payload.user_id:
            query_conditions.append(UserDB.user_id == payload.user_id)
        if username:
            query_conditions.append(func.lower(UserDB.username) == username.lower())
        if email:
            query_conditions.append(func.lower(UserDB.email) == email.lower())

        user_to_add = db.scalar(select(UserDB).where(or_(*query_conditions)))
        if not user_to_add:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User to add was not found",
            )

        existing_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == user_to_add.user_id,
                    UsersHouseholds.household_id == payload.household_id,
                )
            )
        )
        if existing_membership is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this household",
            )

        db.add(
            UsersHouseholds(
                user_id=user_to_add.user_id,
                household_id=payload.household_id,
            )
        )

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to add household member",
            ) from exc

        return HouseholdMember(
            user_id=str(user_to_add.user_id),
            username=user_to_add.username,
            email=user_to_add.email,
        )
