from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from ..input_validation import (
    CATEGORY_NAME_MAX_LENGTH,
    TASK_DESCRIPTION_MAX_LENGTH,
    TASK_NAME_MAX_LENGTH,
)


class CreateTaskRequest(BaseModel):
    household_id: UUID
    name: str = Field(description=f"Task name, max {TASK_NAME_MAX_LENGTH} characters")
    status: str = Field(default="todo", max_length=20)
    description: str | None = Field(
        default=None,
        description=f"Task description, max {TASK_DESCRIPTION_MAX_LENGTH} characters",
    )
    priority: str | None = Field(default=None, max_length=20)
    due_date: datetime | None = None
    recurrence_frequency: str | None = Field(default=None, max_length=20)
    recurrence_interval: int | None = Field(default=1, ge=1, le=365)
    category_id: UUID | None = None
    category_name: str | None = Field(
        default=None,
        description=f"Category name, max {CATEGORY_NAME_MAX_LENGTH} characters",
    )
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
    recurrence_enabled: bool = False
    recurrence_frequency: str | None = None
    recurrence_interval: int | None = None
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
    recurrence_enabled: bool = False
    recurrence_frequency: str | None = None
    recurrence_interval: int | None = None
    assignee_user_id: str | None = None
    assignee_name: str | None = None
    category_name: str | None = None


class KanbanTasksResponse(BaseModel):
    tasks: list[KanbanTask]
    total: int
    limit: int
    offset: int


class KanbanAssignee(BaseModel):
    user_id: str
    username: str
    display_name: str | None = None


class KanbanAssigneesResponse(BaseModel):
    assignees: list[KanbanAssignee]


class HouseholdCategory(BaseModel):
    category_id: str
    name: str


class HouseholdCategoriesResponse(BaseModel):
    categories: list[HouseholdCategory]


class CreateHouseholdCategoryRequest(BaseModel):
    name: str = Field(
        description=f"Category name, max {CATEGORY_NAME_MAX_LENGTH} characters"
    )


class DeleteHouseholdCategoryResponse(BaseModel):
    category_id: str
    deleted: bool


class UpdateTaskStatusRequest(BaseModel):
    status: str = Field(max_length=20)


class UpdateTaskStatusResponse(BaseModel):
    task_id: str
    status: str
    started_at: datetime | None = None
    complete_date: datetime | None = None
    updated_at: datetime | None = None


class UpdateTaskPriorityRequest(BaseModel):
    priority: str = Field(max_length=20)


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


class UpdateTaskRecurrenceRequest(BaseModel):
    recurrence_frequency: str | None = Field(default=None, max_length=20)
    recurrence_interval: int | None = Field(default=1, ge=1, le=365)


class UpdateTaskRecurrenceResponse(BaseModel):
    task_id: str
    recurrence_enabled: bool = False
    recurrence_frequency: str | None = None
    recurrence_interval: int | None = None
    updated_at: datetime | None = None


class SkipTaskOccurrenceRequest(BaseModel):
    occurrence_date: date


class SkipTaskOccurrenceResponse(BaseModel):
    task_id: str
    skipped_occurrence_date: date
    next_due_date: datetime | None = None
    updated_at: datetime | None = None


class UpdateTaskAssigneeRequest(BaseModel):
    assigns_to: UUID | None = None


class UpdateTaskAssigneeResponse(BaseModel):
    task_id: str
    assigns_to: str | None = None
    assignee_name: str | None = None
    updated_at: datetime | None = None


class UpdateTaskCategoryRequest(BaseModel):
    category_name: str | None = Field(
        default=None,
        description=f"Category name, max {CATEGORY_NAME_MAX_LENGTH} characters",
    )


class UpdateTaskCategoryResponse(BaseModel):
    task_id: str
    category_id: str | None = None
    category_name: str | None = None
    updated_at: datetime | None = None


class UpdateTaskDescriptionRequest(BaseModel):
    description: str | None = Field(
        default=None,
        description=f"Task description, max {TASK_DESCRIPTION_MAX_LENGTH} characters",
    )


class UpdateTaskDescriptionResponse(BaseModel):
    task_id: str
    description: str | None = None
    updated_at: datetime | None = None


class UpdateTaskNameRequest(BaseModel):
    name: str = Field(description=f"Task name, max {TASK_NAME_MAX_LENGTH} characters")


class UpdateTaskNameResponse(BaseModel):
    task_id: str
    name: str
    updated_at: datetime | None = None


class DeleteTaskResponse(BaseModel):
    task_id: str
    deleted: bool


class ReorderTasksRequest(BaseModel):
    status: str = Field(max_length=20)
    ordered_task_ids: list[str]


class ReorderTasksResponse(BaseModel):
    status: str
    updated_count: int
    updated_at: datetime | None = None
