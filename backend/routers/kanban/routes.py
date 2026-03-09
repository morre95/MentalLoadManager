from uuid import UUID

from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    CreateTaskRequest,
    DeleteTaskResponse,
    KanbanAssigneesResponse,
    KanbanTasksResponse,
    ReorderTasksRequest,
    ReorderTasksResponse,
    TaskResponse,
    UpdateTaskAssigneeRequest,
    UpdateTaskAssigneeResponse,
    UpdateTaskCategoryRequest,
    UpdateTaskCategoryResponse,
    UpdateTaskDescriptionRequest,
    UpdateTaskDescriptionResponse,
    UpdateTaskDueDateRequest,
    UpdateTaskDueDateResponse,
    UpdateTaskNameRequest,
    UpdateTaskNameResponse,
    UpdateTaskPriorityRequest,
    UpdateTaskPriorityResponse,
    UpdateTaskStatusRequest,
    UpdateTaskStatusResponse,
)
from .service import (
    create_task,
    delete_task,
    list_household_assignees,
    list_kanban_tasks,
    reorder_tasks,
    update_task_assignee,
    update_task_category,
    update_task_description,
    update_task_due_date,
    update_task_name,
    update_task_priority,
    update_task_status,
)

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


@router.get("/tasks", response_model=KanbanTasksResponse)
def list_kamban_tasks_route(
    household_id: UUID | None = None,
    current_user: UserEmail = Depends(get_current_user),
):
    return list_kanban_tasks(household_id, current_user)


@router.get("/households/{household_id}/assignees", response_model=KanbanAssigneesResponse)
def list_household_assignees_route(
    household_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return list_household_assignees(household_id, current_user)


@router.post("", response_model=TaskResponse, status_code=201)
def create_task_route(
    payload: CreateTaskRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return create_task(payload, current_user)


@router.patch("/tasks/{task_id}/status", response_model=UpdateTaskStatusResponse)
def update_task_status_route(
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_status(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/priority", response_model=UpdateTaskPriorityResponse)
def update_task_priority_route(
    task_id: UUID,
    payload: UpdateTaskPriorityRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_priority(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/due-date", response_model=UpdateTaskDueDateResponse)
def update_task_due_date_route(
    task_id: UUID,
    payload: UpdateTaskDueDateRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_due_date(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/assignee", response_model=UpdateTaskAssigneeResponse)
def update_task_assignee_route(
    task_id: UUID,
    payload: UpdateTaskAssigneeRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_assignee(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/description", response_model=UpdateTaskDescriptionResponse)
def update_task_description_route(
    task_id: UUID,
    payload: UpdateTaskDescriptionRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_description(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/category", response_model=UpdateTaskCategoryResponse)
def update_task_category_route(
    task_id: UUID,
    payload: UpdateTaskCategoryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_category(task_id, payload, current_user)


@router.patch("/tasks/{task_id}/name", response_model=UpdateTaskNameResponse)
def update_task_name_route(
    task_id: UUID,
    payload: UpdateTaskNameRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_task_name(task_id, payload, current_user)


@router.delete("/tasks/{task_id}", response_model=DeleteTaskResponse)
def delete_task_route(
    task_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return delete_task(task_id, current_user)


@router.patch("/tasks/reorder", response_model=ReorderTasksResponse)
def reorder_tasks_route(
    payload: ReorderTasksRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return reorder_tasks(payload, current_user)
