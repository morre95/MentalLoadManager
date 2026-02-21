from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateTaskRequest(BaseModel):
    household_id: UUID
    name: str
    status: str = "todo"
    description: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    category_id: UUID | None = None
    category_name: str | None = None
    assigns_to: UUID | None = None
    started_at: datetime | None = None
    complete_date: datetime | None = None


class TaskResponse(BaseModel):
    task_id: str
    household_id: str
    name: str
    status: str
    description: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    category_id: str | None = None
    assigns_to: str | None = None
    created_by: str | None = None
    started_at: datetime | None = None
    complete_date: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class KanbanTask(BaseModel):
    task_id: str
    household_id: str
    name: str
    description: str | None = None
    status: str
    priority: str
    due_date: datetime | None = None
    assignee_user_id: str | None = None
    assignee_name: str | None = None
    category_name: str | None = None


class KanbanTasksResponse(BaseModel):
    tasks: list[KanbanTask]


class KanbanAssignee(BaseModel):
    user_id: str
    username: str
    display_name: str | None = None


class KanbanAssigneesResponse(BaseModel):
    assignees: list[KanbanAssignee]


class UpdateTaskStatusRequest(BaseModel):
    status: str


class UpdateTaskStatusResponse(BaseModel):
    task_id: str
    status: str
    started_at: datetime | None = None
    complete_date: datetime | None = None
    updated_at: datetime | None = None


class UpdateTaskPriorityRequest(BaseModel):
    priority: str


class UpdateTaskPriorityResponse(BaseModel):
    task_id: str
    priority: str | None = None
    updated_at: datetime | None = None


class UpdateTaskDueDateRequest(BaseModel):
    due_date: datetime | None = None


class UpdateTaskDueDateResponse(BaseModel):
    task_id: str
    due_date: datetime | None = None
    updated_at: datetime | None = None


class UpdateTaskAssigneeRequest(BaseModel):
    assigns_to: UUID | None = None


class UpdateTaskAssigneeResponse(BaseModel):
    task_id: str
    assigns_to: str | None = None
    assignee_name: str | None = None
    updated_at: datetime | None = None


class UpdateTaskCategoryRequest(BaseModel):
    category_name: str | None = None


class UpdateTaskCategoryResponse(BaseModel):
    task_id: str
    category_id: str | None = None
    category_name: str | None = None
    updated_at: datetime | None = None


class UpdateTaskDescriptionRequest(BaseModel):
    description: str | None = None


class UpdateTaskDescriptionResponse(BaseModel):
    task_id: str
    description: str | None = None
    updated_at: datetime | None = None


class UpdateTaskNameRequest(BaseModel):
    name: str


class UpdateTaskNameResponse(BaseModel):
    task_id: str
    name: str
    updated_at: datetime | None = None


class DeleteTaskResponse(BaseModel):
    task_id: str
    deleted: bool


class ReorderTasksRequest(BaseModel):
    status: str
    ordered_task_ids: list[str]


class ReorderTasksResponse(BaseModel):
    status: str
    updated_count: int
    updated_at: datetime | None = None
