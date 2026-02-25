from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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


class TransferOwnershipRequest(BaseModel):
    household_id: UUID
    new_owner_user_id: UUID
