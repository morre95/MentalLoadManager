# backend/routers/household.py

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID


from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, delete
from sqlalchemy.exc import IntegrityError


from helpers import get_current_user, get_session_local
from models import Households, Invitations, UserDB, UsersHouseholds, UserEmail

router = APIRouter(prefix="/api/household", tags=["household"])

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


# =========================
# Pydantic models
# =========================
class HouseholdMember(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    display_name: str | None = None


class HouseholdMembersResponse(BaseModel):
    members: list[HouseholdMember]


class AddHouseholdMemberRequest(BaseModel):
    household_id: UUID
    user_id: UUID | None = None
    username: str | None = None
    email: str | None = None


class CreateHouseholdRequest(BaseModel):
    name: str


class CreateHouseholdResponse(BaseModel):
    household_id: str
    name: str


class HouseholdWithMembers(BaseModel):
    household_id: str
    name: str
    members: list[HouseholdMember]


class MyHouseholdsResponse(BaseModel):
    households: list[HouseholdWithMembers]


class InviteResponse(BaseModel):
    code: str
    invite_url: str
    expires_at: datetime


class InviteCreateRequest(BaseModel):
    # Pattern A: invite for a specific household
    household_id: UUID


class AcceptInviteRequest(BaseModel):
    code: str


class AcceptInviteResponse(BaseModel):
    household_id: str


class RemoveHouseholdMemberRequest(BaseModel):
    household_id: UUID
    user_id: UUID


class LeaveHouseholdRequest(BaseModel):
    household_id: UUID


# =========================
# Helpers
# =========================
def _get_db_user(db, current_user: UserEmail) -> UserDB:
    user = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# =========================
# Endpoints
# =========================
@router.get("/members", response_model=HouseholdMembersResponse)
def list_household_members(current_user: UserEmail = Depends(get_current_user)):
    """
    Union of members across ALL households the current user belongs to.
    """
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    with session_local() as db:
        me = _get_db_user(db, current_user)

        household_ids = db.scalars(
            select(UsersHouseholds.household_id).where(
                UsersHouseholds.user_id == me.user_id
            )
        ).all()

        if not household_ids:
            return HouseholdMembersResponse(members=[])

        rows = db.execute(
            select(
                UserDB.user_id,
                UserDB.username,
                UserDB.email,
                UserDB.display_name,
            )
            .distinct(UserDB.user_id)
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id.in_(household_ids))
            .order_by(UserDB.user_id, UserDB.username.asc())
        ).all()

        return HouseholdMembersResponse(
            members=[
                HouseholdMember(
                    user_id=str(r.user_id),
                    username=r.username,
                    email=r.email,
                    display_name=r.display_name,
                )
                for r in rows
            ]
        )


@router.post(
    "",
    response_model=CreateHouseholdResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_household(
    payload: CreateHouseholdRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Household name is required")

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    with session_local() as db:
        me = _get_db_user(db, current_user)

        new_household = Households(name=name)
        db.add(new_household)
        db.flush()

        db.add(
            UsersHouseholds(
                user_id=me.user_id,
                household_id=new_household.household_id,
            )
        )

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Unable to create household"
            ) from exc

        return CreateHouseholdResponse(
            household_id=str(new_household.household_id),
            name=new_household.name,
        )


@router.post(
    "/members",
    response_model=HouseholdMember,
    status_code=status.HTTP_201_CREATED,
)
def add_household_member(
    payload: AddHouseholdMemberRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    """
    Adds a user to a household (must already be a member yourself).
    """
    if not any([payload.user_id, payload.username, payload.email]):
        raise HTTPException(
            status_code=400, detail="One of user_id, username, or email is required"
        )

    username = payload.username.strip() if payload.username else None
    email = payload.email.strip() if payload.email else None

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    with session_local() as db:
        me = _get_db_user(db, current_user)

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
                status_code=403,
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
            raise HTTPException(status_code=404, detail="User to add was not found")

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
                status_code=409, detail="User is already a member of this household"
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
                status_code=409, detail="Unable to add household member"
            ) from exc

        return HouseholdMember(
            user_id=str(user_to_add.user_id),
            username=user_to_add.username,
            email=user_to_add.email,
            display_name=user_to_add.display_name,
        )

    """
    Backwards-compatible single-household endpoint:
    returns the FIRST household the user belongs to (by join order).
    """
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        uh = db.scalar(
            select(UsersHouseholds).where(UsersHouseholds.user_id == user.user_id)
        )
        if not uh:
            raise HTTPException(
                status_code=404, detail="User is not in a household yet"
            )

        household = db.scalar(
            select(Households).where(Households.household_id == uh.household_id)
        )
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")

        rows = db.execute(
            select(UserDB.user_id, UserDB.username, UserDB.email, UserDB.display_name)
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id == household.household_id)
            .order_by(UserDB.username.asc())
        ).all()

        return HouseholdWithMembers(
            household_id=str(household.household_id),
            name=household.name,
            members=[
                HouseholdMember(
                    user_id=str(r.user_id),
                    username=r.username,
                    email=r.email,
                    display_name=r.display_name,
                )
                for r in rows
            ],
        )


@router.get("", response_model=MyHouseholdsResponse)
def get_my_households(current_user: UserEmail = Depends(get_current_user)):
    """
    Multi-household endpoint:
    returns ALL households + their members.
    """
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        household_rows = db.execute(
            select(Households.household_id, Households.name)
            .join(
                UsersHouseholds, UsersHouseholds.household_id == Households.household_id
            )
            .where(UsersHouseholds.user_id == user.user_id)
            .order_by(Households.name.asc())
        ).all()

        if not household_rows:
            return MyHouseholdsResponse(households=[])

        household_ids = [r.household_id for r in household_rows]

        member_rows = db.execute(
            select(
                UsersHouseholds.household_id,
                UserDB.user_id,
                UserDB.username,
                UserDB.email,
                UserDB.display_name,
            )
            .join(UserDB, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id.in_(household_ids))
            .order_by(UsersHouseholds.household_id, UserDB.username.asc())
        ).all()

        members_by_household: dict[str, list[HouseholdMember]] = {}
        for r in member_rows:
            hid = str(r.household_id)
            members_by_household.setdefault(hid, []).append(
                HouseholdMember(
                    user_id=str(r.user_id),
                    username=r.username,
                    email=r.email,
                    display_name=r.display_name,
                )
            )

        households = [
            HouseholdWithMembers(
                household_id=str(h.household_id),
                name=h.name,
                members=members_by_household.get(str(h.household_id), []),
            )
            for h in household_rows
        ]

        return MyHouseholdsResponse(households=households)


@router.post("/invite", response_model=InviteResponse)
def create_invite(
    payload: InviteCreateRequest, current_user: UserEmail = Depends(get_current_user)
):
    """
    Pattern A:
    Create an invite for a SPECIFIC household (payload.household_id),
    only if the current user is a member of that household.
    """
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        # Must be a member of that household to invite
        membership = db.scalar(
            select(UsersHouseholds).where(
                UsersHouseholds.user_id == user.user_id,
                UsersHouseholds.household_id == payload.household_id,
            )
        )
        if not membership:
            raise HTTPException(
                status_code=403, detail="You are not a member of that household"
            )

        code = secrets.token_urlsafe(16)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        inv = Invitations(
            household_id=payload.household_id,
            code=code,
            expires_at=expires_at,
            created_by=user.user_id,
        )
        db.add(inv)
        db.commit()

        invite_url = f"{FRONTEND_BASE_URL}/join?code={code}"
        return InviteResponse(code=code, invite_url=invite_url, expires_at=expires_at)


@router.post("/invite/accept", response_model=AcceptInviteResponse)
def accept_invite(
    payload: AcceptInviteRequest, current_user: UserEmail = Depends(get_current_user)
):
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        inv = db.scalar(select(Invitations).where(Invitations.code == payload.code))
        if not inv:
            raise HTTPException(status_code=404, detail="Invite not found")

        if inv.expires_at and inv.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite has expired")

        existing = db.scalar(
            select(UsersHouseholds).where(
                UsersHouseholds.user_id == user.user_id,
                UsersHouseholds.household_id == inv.household_id,
            )
        )
        if existing:
            return AcceptInviteResponse(household_id=str(inv.household_id))

        db.add(
            UsersHouseholds(
                user_id=user.user_id,
                household_id=inv.household_id,
            )
        )

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return AcceptInviteResponse(household_id=str(inv.household_id))

        return AcceptInviteResponse(household_id=str(inv.household_id))


@router.delete("/members", status_code=status.HTTP_204_NO_CONTENT)
def remove_household_member(
    payload: RemoveHouseholdMemberRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    """
    Remove a user from a household.
    Rules:
    - You must be a member of the household.
    - You cannot remove yourself.
    """
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        # must be member of this household
        my_membership = db.scalar(
            select(UsersHouseholds).where(
                UsersHouseholds.user_id == me.user_id,
                UsersHouseholds.household_id == payload.household_id,
            )
        )
        if not my_membership:
            raise HTTPException(
                status_code=403, detail="Not a member of that household"
            )

        # cannot remove yourself
        if payload.user_id == me.user_id:
            raise HTTPException(status_code=400, detail="You cannot remove yourself")

        membership = db.scalar(
            select(UsersHouseholds).where(
                UsersHouseholds.user_id == payload.user_id,
                UsersHouseholds.household_id == payload.household_id,
            )
        )
        if not membership:
            raise HTTPException(status_code=404, detail="User is not in that household")

        db.delete(membership)
        db.flush()
        _delete_household_if_empty(db, payload.household_id)
        db.commit()

    return


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_household(
    payload: LeaveHouseholdRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        membership = db.scalar(
            select(UsersHouseholds).where(
                UsersHouseholds.user_id == me.user_id,
                UsersHouseholds.household_id == payload.household_id,
            )
        )
        if not membership:
            raise HTTPException(status_code=404, detail="You are not in that household")

        db.delete(membership)
        db.flush()
        _delete_household_if_empty(db, payload.household_id)
        db.commit()

    return


def _delete_household_if_empty(db, household_id: UUID) -> None:
    remaining = db.scalar(
        select(func.count())
        .select_from(UsersHouseholds)
        .where(UsersHouseholds.household_id == household_id)
    )

    if (remaining or 0) == 0:
        db.execute(delete(Households).where(Households.household_id == household_id))
