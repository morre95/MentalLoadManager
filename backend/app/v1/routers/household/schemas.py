from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from ..input_validation import HOUSEHOLD_NAME_MAX_LENGTH


class HouseholdMember(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    role: str


class HouseholdMembersResponse(BaseModel):
    members: list[HouseholdMember]


class AddHouseholdMemberRequest(BaseModel):
    household_id: UUID
    user_id: UUID | None = None
    username: str | None = None
    email: str | None = None


class CreateHouseholdRequest(BaseModel):
    name: str = Field(
        description=f"Household name, max {HOUSEHOLD_NAME_MAX_LENGTH} characters"
    )


class CreateHouseholdResponse(BaseModel):
    household_id: str
    name: str


class UpdateHouseholdRequest(BaseModel):
    household_id: UUID
    name: str = Field(
        description=f"Household name, max {HOUSEHOLD_NAME_MAX_LENGTH} characters"
    )


class UpdateHouseholdResponse(BaseModel):
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
    household_id: UUID


class InviteEmailRequest(BaseModel):
    household_id: UUID
    email: str = Field(min_length=3, max_length=320)


class InviteEmailResponse(BaseModel):
    message: str
    invite_url: str
    expires_at: datetime


class InviteNotification(BaseModel):
    id: str
    recipient_email: str
    household_name: str
    status: str
    created_at: datetime


class InviteNotificationsResponse(BaseModel):
    notifications: list[InviteNotification]


class AcceptInviteRequest(BaseModel):
    code: str


class AcceptInviteResponse(BaseModel):
    household_id: str


class RemoveHouseholdMemberRequest(BaseModel):
    household_id: UUID
    user_id: UUID


class LeaveHouseholdRequest(BaseModel):
    household_id: UUID


class TransferOwnershipRequest(BaseModel):
    household_id: UUID
    new_owner_user_id: UUID


class UpdateHouseholdMemberRoleRequest(BaseModel):
    household_id: UUID
    user_id: UUID
    role: str
