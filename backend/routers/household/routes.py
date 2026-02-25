from fastapi import APIRouter, Depends, status

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    AddHouseholdMemberRequest,
    CreateHouseholdRequest,
    CreateHouseholdResponse,
    HouseholdMember,
    HouseholdMembersResponse,
    InviteCreateRequest,
    InviteResponse,
    LeaveHouseholdRequest,
    MyHouseholdsResponse,
    RemoveHouseholdMemberRequest,
    TransferOwnershipRequest,
)
from .service import (
    accept_invite,
    add_household_member,
    create_household,
    create_invite,
    get_my_households,
    leave_household,
    list_household_members,
    remove_household_member,
    transfer_household_ownership,
)

router = APIRouter(prefix="/api/household", tags=["household"])


@router.get("/members", response_model=HouseholdMembersResponse)
def list_household_members_route(current_user: UserEmail = Depends(get_current_user)):
    return list_household_members(current_user)


@router.post("", response_model=CreateHouseholdResponse, status_code=status.HTTP_201_CREATED)
def create_household_route(
    payload: CreateHouseholdRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return create_household(payload, current_user)


@router.post("/members", response_model=HouseholdMember, status_code=status.HTTP_201_CREATED)
def add_household_member_route(
    payload: AddHouseholdMemberRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return add_household_member(payload, current_user)


@router.get("", response_model=MyHouseholdsResponse)
def get_my_households_route(current_user: UserEmail = Depends(get_current_user)):
    return get_my_households(current_user)


@router.post("/invite", response_model=InviteResponse)
def create_invite_route(
    payload: InviteCreateRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return create_invite(payload, current_user)


@router.post("/invite/accept", response_model=AcceptInviteResponse)
def accept_invite_route(
    payload: AcceptInviteRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return accept_invite(payload, current_user)


@router.delete("/members", status_code=status.HTTP_204_NO_CONTENT)
def remove_household_member_route(
    payload: RemoveHouseholdMemberRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    remove_household_member(payload, current_user)
    return


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_household_route(
    payload: LeaveHouseholdRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    leave_household(payload, current_user)
    return


@router.post("/transfer-ownership", status_code=status.HTTP_204_NO_CONTENT)
def transfer_household_ownership_route(
    payload: TransferOwnershipRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    transfer_household_ownership(payload, current_user)
    return
