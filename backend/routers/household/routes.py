from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status

from helpers import get_current_user
from models import UserEmail
from ..kanban.schemas import (
    CreateHouseholdCategoryRequest,
    DeleteHouseholdCategoryResponse,
    HouseholdCategoriesResponse,
    HouseholdCategory,
)
from ..kanban.service import (
    create_household_category,
    delete_household_category,
    list_household_categories,
)

from .schemas import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    AddHouseholdMemberRequest,
    CreateHouseholdRequest,
    CreateHouseholdResponse,
    HouseholdMember,
    HouseholdMembersResponse,
    InviteCreateRequest,
    InviteEmailRequest,
    InviteEmailResponse,
    InviteNotificationsResponse,
    InviteResponse,
    LeaveHouseholdRequest,
    MyHouseholdsResponse,
    RemoveHouseholdMemberRequest,
    TransferOwnershipRequest,
    UpdateHouseholdRequest,
    UpdateHouseholdResponse,
    UpdateHouseholdMemberRoleRequest,
)
from .service import (
    accept_invite,
    add_household_member,
    create_household,
    email_invite,
    create_invite,
    get_invite_notifications,
    get_my_households,
    leave_household,
    list_household_members,
    remove_household_member,
    transfer_household_ownership,
    update_household,
    update_household_member_role,
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


@router.put("", response_model=UpdateHouseholdResponse)
def update_household_route(
    payload: UpdateHouseholdRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_household(payload, current_user)


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


@router.post("/invite/email", response_model=InviteEmailResponse)
def email_invite_route(
    payload: InviteEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: UserEmail = Depends(get_current_user),
):
    return email_invite(payload, current_user, background_tasks)


@router.get("/invite/notifications", response_model=InviteNotificationsResponse)
def get_invite_notifications_route(current_user: UserEmail = Depends(get_current_user)):
    return get_invite_notifications(current_user)


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


@router.put("/members/role", response_model=HouseholdMember)
def update_household_member_role_route(
    payload: UpdateHouseholdMemberRoleRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_household_member_role(payload, current_user)


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


@router.get("/{household_id}/categories", response_model=HouseholdCategoriesResponse)
def list_household_categories_route(
    household_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return list_household_categories(household_id, current_user)


@router.post("/{household_id}/categories", response_model=HouseholdCategory, status_code=201)
def create_household_category_route(
    household_id: UUID,
    payload: CreateHouseholdCategoryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return create_household_category(household_id, payload, current_user)


@router.delete(
    "/{household_id}/categories/{category_id}",
    response_model=DeleteHouseholdCategoryResponse,
)
def delete_household_category_route(
    household_id: UUID,
    category_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return delete_household_category(household_id, category_id, current_user)
