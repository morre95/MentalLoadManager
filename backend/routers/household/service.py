from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from helpers import get_session_local
from models import Households, Invitations, UserEmail, UsersHouseholds

from .repository import (
    count_household_members,
    delete_household,
    find_households_for_user,
    find_invite_by_code,
    find_membership,
    find_user_to_add,
    get_memberships_for_user,
    get_user_by_username,
    list_household_member_rows,
    list_members_for_households,
    unassign_user_tasks_in_household,
)
from .schemas import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    AddHouseholdMemberRequest,
    CreateHouseholdRequest,
    CreateHouseholdResponse,
    HouseholdMember,
    HouseholdMembersResponse,
    HouseholdWithMembers,
    InviteCreateRequest,
    InviteResponse,
    LeaveHouseholdRequest,
    MyHouseholdsResponse,
    RemoveHouseholdMemberRequest,
)

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


def _get_db_user(db, current_user: UserEmail):
    user = get_user_by_username(db, current_user.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def list_household_members(current_user: UserEmail) -> HouseholdMembersResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    with session_local() as db:
        me = _get_db_user(db, current_user)
        household_ids = get_memberships_for_user(db, me.user_id)

        if not household_ids:
            return HouseholdMembersResponse(members=[])

        rows = list_members_for_households(db, household_ids)
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


def create_household(
    payload: CreateHouseholdRequest,
    current_user: UserEmail,
) -> CreateHouseholdResponse:
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
            raise HTTPException(status_code=409, detail="Unable to create household") from exc

        return CreateHouseholdResponse(
            household_id=str(new_household.household_id),
            name=new_household.name,
        )


def add_household_member(
    payload: AddHouseholdMemberRequest,
    current_user: UserEmail,
) -> HouseholdMember:
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

        my_membership = find_membership(db, me.user_id, payload.household_id)
        if my_membership is None:
            raise HTTPException(
                status_code=403,
                detail="User is not a member of the specified household",
            )

        user_to_add = find_user_to_add(
            db,
            user_id=payload.user_id,
            username=username,
            email=email,
        )
        if not user_to_add:
            raise HTTPException(status_code=404, detail="User to add was not found")

        existing_membership = find_membership(db, user_to_add.user_id, payload.household_id)
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


def get_my_households(current_user: UserEmail) -> MyHouseholdsResponse:
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        household_rows = find_households_for_user(db, user.user_id)
        if not household_rows:
            return MyHouseholdsResponse(households=[])

        household_ids = [r.household_id for r in household_rows]
        member_rows = list_household_member_rows(db, household_ids)

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


def create_invite(payload: InviteCreateRequest, current_user: UserEmail) -> InviteResponse:
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        membership = find_membership(db, user.user_id, payload.household_id)
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


def accept_invite(payload: AcceptInviteRequest, current_user: UserEmail) -> AcceptInviteResponse:
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        inv = find_invite_by_code(db, payload.code)
        if not inv:
            raise HTTPException(status_code=404, detail="Invite not found")

        if inv.expires_at and inv.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite has expired")

        existing = find_membership(db, user.user_id, inv.household_id)
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


def remove_household_member(
    payload: RemoveHouseholdMemberRequest,
    current_user: UserEmail,
) -> None:
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        my_membership = find_membership(db, me.user_id, payload.household_id)
        if not my_membership:
            raise HTTPException(status_code=403, detail="Not a member of that household")

        if payload.user_id == me.user_id:
            raise HTTPException(status_code=400, detail="You cannot remove yourself")

        membership = find_membership(db, payload.user_id, payload.household_id)
        if not membership:
            raise HTTPException(status_code=404, detail="User is not in that household")

        unassign_user_tasks_in_household(db, payload.household_id, payload.user_id)
        db.delete(membership)
        db.flush()
        _delete_household_if_empty(db, payload.household_id)
        db.commit()


def leave_household(payload: LeaveHouseholdRequest, current_user: UserEmail) -> None:
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        membership = find_membership(db, me.user_id, payload.household_id)
        if not membership:
            raise HTTPException(status_code=404, detail="You are not in that household")

        unassign_user_tasks_in_household(db, payload.household_id, me.user_id)
        db.delete(membership)
        db.flush()
        _delete_household_if_empty(db, payload.household_id)
        db.commit()


def _delete_household_if_empty(db, household_id: UUID) -> None:
    remaining = count_household_members(db, household_id)
    if remaining == 0:
        delete_household(db, household_id)
