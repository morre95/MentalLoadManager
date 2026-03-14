from __future__ import annotations

import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from html import escape
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from helpers import get_session_local
from models import Households, Invitations, UserEmail, UsersHouseholds

from .repository import (
    count_household_members,
    delete_household,
    find_household_by_id,
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
    InviteEmailRequest,
    InviteEmailResponse,
    InviteResponse,
    LeaveHouseholdRequest,
    MyHouseholdsResponse,
    RemoveHouseholdMemberRequest,
    TransferOwnershipRequest,
    UpdateHouseholdRequest,
    UpdateHouseholdResponse,
    UpdateHouseholdMemberRoleRequest,
)
from config import settings

FRONTEND_BASE_URL = settings.FRONTEND_URL or "http://localhost:5173"
ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"
PRIVILEGED_HOUSEHOLD_ROLES = {ROLE_OWNER, ROLE_ADMIN}
logger = logging.getLogger(__name__)


def _get_db_user(db, current_user: UserEmail):
    user = get_user_by_username(db, current_user.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _create_invite_for_household(db, household_id: UUID, user_id: UUID) -> InviteResponse:
    code = secrets.token_urlsafe(16)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    inv = Invitations(
        household_id=household_id,
        code=code,
        expires_at=expires_at,
        created_by=user_id,
    )
    db.add(inv)
    db.commit()

    invite_url = f"{FRONTEND_BASE_URL}/join?code={code}"
    return InviteResponse(code=code, invite_url=invite_url, expires_at=expires_at)


def _build_household_invite_email_body(
    *,
    household_name: str,
    invite_url: str,
    inviter_name: str,
    expires_at: datetime,
) -> str:
    escaped_household_name = escape(household_name)
    escaped_invite_url = escape(invite_url)
    escaped_inviter_name = escape(inviter_name)
    expires_label = escape(expires_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))

    return (
        f"<h2>{escaped_inviter_name} invited you to join {escaped_household_name}</h2>"
        "<p>Use the link below to accept the household invitation:</p>"
        f'<p><a href="{escaped_invite_url}">{escaped_invite_url}</a></p>'
        f"<p>This invite expires on {expires_label}.</p>"
    )


async def _send_household_invite_email(
    *,
    recipient_email: str,
    household_name: str,
    invite_url: str,
    inviter_name: str,
    inviter_email: str | None,
    expires_at: datetime,
) -> None:
    import resend

    api_key = settings.RESEND_API_KEY.strip()
    mail_from = settings.MAIL_FROM.strip()

    if not api_key or not mail_from:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invite email is not configured",
        )

    resend.api_key = api_key

    params: resend.Emails.SendParams = {
        "from": f"{settings.MAIL_FROM_NAME} <{mail_from}>",
        "to": [recipient_email],
        "subject": f"{inviter_name} invited you to join {household_name}",
        "html": _build_household_invite_email_body(
            household_name=household_name,
            invite_url=invite_url,
            inviter_name=inviter_name,
            expires_at=expires_at,
        ),
    }
    if inviter_email:
        params["reply_to"] = inviter_email

    try:
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as exc:
        logger.exception("Failed to send household invite email: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invite was created, but the email could not be sent",
        ) from exc


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
                    role=r.role,
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
                role=ROLE_OWNER,
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


def update_household(
    payload: UpdateHouseholdRequest,
    current_user: UserEmail,
) -> UpdateHouseholdResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Household name is required")

    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)
        my_membership = find_membership(db, me.user_id, payload.household_id)
        if not my_membership:
            raise HTTPException(status_code=403, detail="Not a member of that household")
        if my_membership.role not in PRIVILEGED_HOUSEHOLD_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only owners and admins can rename the household",
            )

        household = find_household_by_id(db, payload.household_id)
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")

        household.name = name
        db.commit()

        return UpdateHouseholdResponse(
            household_id=str(household.household_id),
            name=household.name,
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

        existing_membership = find_membership(
            db, user_to_add.user_id, payload.household_id
        )
        if existing_membership is not None:
            raise HTTPException(
                status_code=409, detail="User is already a member of this household"
            )

        db.add(
            UsersHouseholds(
                user_id=user_to_add.user_id,
                household_id=payload.household_id,
                role=ROLE_MEMBER,
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
            role=ROLE_MEMBER,
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
                    role=r.role,
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


def create_invite(
    payload: InviteCreateRequest, current_user: UserEmail
) -> InviteResponse:
    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)

        membership = find_membership(db, user.user_id, payload.household_id)
        if not membership:
            raise HTTPException(
                status_code=403, detail="You are not a member of that household"
            )
        return _create_invite_for_household(db, payload.household_id, user.user_id)


async def email_invite(
    payload: InviteEmailRequest, current_user: UserEmail
) -> InviteEmailResponse:
    recipient_email = payload.email.strip().lower()
    if not recipient_email or "@" not in recipient_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email is required",
        )

    session_local = get_session_local()

    with session_local() as db:
        user = _get_db_user(db, current_user)
        membership = find_membership(db, user.user_id, payload.household_id)
        if not membership:
            raise HTTPException(
                status_code=403, detail="You are not a member of that household"
            )

        household = find_household_by_id(db, payload.household_id)
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")

        invite = _create_invite_for_household(db, payload.household_id, user.user_id)
        inviter_name = user.display_name or user.username
        inviter_email = user.email
        household_name = household.name

    await _send_household_invite_email(
        recipient_email=recipient_email,
        household_name=household_name,
        invite_url=invite.invite_url,
        inviter_name=inviter_name,
        inviter_email=inviter_email,
        expires_at=invite.expires_at,
    )

    return InviteEmailResponse(
        message="Invite email sent successfully",
        invite_url=invite.invite_url,
        expires_at=invite.expires_at,
    )


def accept_invite(
    payload: AcceptInviteRequest, current_user: UserEmail
) -> AcceptInviteResponse:
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
                role=ROLE_MEMBER,
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
            raise HTTPException(
                status_code=403, detail="Not a member of that household"
            )
        if my_membership.role not in PRIVILEGED_HOUSEHOLD_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only owners and admins can remove household members",
            )

        if payload.user_id == me.user_id:
            raise HTTPException(status_code=400, detail="You cannot remove yourself")

        target_membership = find_membership(db, payload.user_id, payload.household_id)
        if not target_membership:
            raise HTTPException(status_code=404, detail="User is not in that household")
        if target_membership.role == ROLE_OWNER:
            raise HTTPException(status_code=403, detail="Owner cannot be removed")
        if my_membership.role == ROLE_ADMIN and target_membership.role == ROLE_ADMIN:
            raise HTTPException(
                status_code=403, detail="Admins cannot remove other admins"
            )

        unassign_user_tasks_in_household(db, payload.household_id, payload.user_id)
        db.delete(target_membership)
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
        if membership.role == ROLE_OWNER:
            member_count = count_household_members(db, payload.household_id)
            if member_count > 1:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Owner cannot leave while other members exist. "
                        "Transfer ownership first."
                    ),
                )

        unassign_user_tasks_in_household(db, payload.household_id, me.user_id)
        db.delete(membership)
        db.flush()
        _delete_household_if_empty(db, payload.household_id)
        db.commit()


def transfer_household_ownership(
    payload: TransferOwnershipRequest,
    current_user: UserEmail,
) -> None:
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)
        my_membership = find_membership(db, me.user_id, payload.household_id)
        if not my_membership:
            raise HTTPException(
                status_code=403, detail="Not a member of that household"
            )
        if my_membership.role != ROLE_OWNER:
            raise HTTPException(
                status_code=403, detail="Only the owner can transfer ownership"
            )
        if payload.new_owner_user_id == me.user_id:
            raise HTTPException(
                status_code=400, detail="New owner must be a different member"
            )

        target_membership = find_membership(
            db, payload.new_owner_user_id, payload.household_id
        )
        if not target_membership:
            raise HTTPException(status_code=404, detail="Target user is not a member")

        my_membership.role = ROLE_ADMIN
        target_membership.role = ROLE_OWNER
        db.commit()


def update_household_member_role(
    payload: UpdateHouseholdMemberRoleRequest,
    current_user: UserEmail,
) -> HouseholdMember:
    next_role = str(payload.role or "").strip().lower()
    if next_role not in {ROLE_ADMIN, ROLE_MEMBER}:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        my_membership = find_membership(db, me.user_id, payload.household_id)
        if not my_membership:
            raise HTTPException(status_code=403, detail="Not a member of that household")
        if my_membership.role not in PRIVILEGED_HOUSEHOLD_ROLES:
            raise HTTPException(
                status_code=403, detail="Only owners and admins can change member roles"
            )
        if payload.user_id == me.user_id:
            raise HTTPException(status_code=400, detail="You cannot change your own role")

        target_membership = find_membership(db, payload.user_id, payload.household_id)
        if not target_membership:
            raise HTTPException(status_code=404, detail="User is not in that household")
        if target_membership.role == ROLE_OWNER:
            raise HTTPException(status_code=403, detail="Owner role cannot be changed")
        if my_membership.role == ROLE_ADMIN and target_membership.role == ROLE_ADMIN:
            raise HTTPException(
                status_code=403, detail="Admins cannot change other admins"
            )

        target_membership.role = next_role
        db.commit()

        return HouseholdMember(
            user_id=str(target_membership.user.user_id),
            username=target_membership.user.username,
            email=target_membership.user.email,
            display_name=target_membership.user.display_name,
            role=target_membership.role,
        )


def _delete_household_if_empty(db, household_id: UUID) -> None:
    remaining = count_household_members(db, household_id)
    if remaining == 0:
        delete_household(db, household_id)
