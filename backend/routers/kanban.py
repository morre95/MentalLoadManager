from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_, case, func
from sqlalchemy.exc import IntegrityError

from helpers import get_current_user, get_session_local
from models import Categories, Tasks, UserDB, UserEmail, UsersHouseholds

router = APIRouter(
    prefix="/api/kanban",
    tags=["kanban"],
)


ALLOWED_TASK_STATUSES = {"todo", "in_progress", "done", "on_hold", "archive"}
ALLOWED_TASK_PRIORITIES = {"low", "medium", "high"}


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
    priority: str
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


@router.get("/tasks", response_model=KanbanTasksResponse)
def list_kamban_tasks(
    household_id: UUID | None = None,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if household_id:
            requester_membership = db.scalar(
                select(UsersHouseholds).where(
                    and_(
                        UsersHouseholds.user_id == me.user_id,
                        UsersHouseholds.household_id == household_id,
                    )
                )
            )
            if requester_membership is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is not a member of the specified household",
                )

        priority_sort = case(
            (Tasks.priority == "high", 0),
            (Tasks.priority == "medium", 1),
            (Tasks.priority == "low", 2),
            else_=3,
        )

        query = (
            select(
                Tasks.task_id,
                Tasks.household_id,
                Tasks.name,
                Tasks.description,
                Tasks.status,
                Tasks.priority,
                Tasks.due_date,
                Tasks.assigns_to.label("assignee_user_id"),
                func.coalesce(UserDB.display_name, UserDB.username).label("assignee_name"),
                Categories.name.label("category_name"),
            )
            .join(
                UsersHouseholds,
                and_(
                    UsersHouseholds.household_id == Tasks.household_id,
                    UsersHouseholds.user_id == me.user_id,
                ),
            )
            .outerjoin(UserDB, Tasks.assigns_to == UserDB.user_id)
            .outerjoin(Categories, Tasks.category_id == Categories.category_id)
            .order_by(
                case((Tasks.order.is_(None), 1), else_=0),
                Tasks.order.asc().nulls_last(),
                priority_sort,
                Tasks.due_date.asc().nulls_last(),
                Tasks.created_at.desc(),
            )
        )
        if household_id:
            query = query.where(Tasks.household_id == household_id)

        rows = db.execute(query).all()

    return KanbanTasksResponse(
        tasks=[
            KanbanTask(
                task_id=str(row.task_id),
                household_id=str(row.household_id),
                name=row.name,
                description=row.description,
                status=row.status,
                priority=row.priority,
                due_date=row.due_date,
                assignee_user_id=str(row.assignee_user_id)
                if row.assignee_user_id
                else None,
                assignee_name=row.assignee_name,
                category_name=row.category_name,
            )
            for row in rows
        ]
    )


@router.get(
    "/households/{household_id}/assignees",
    response_model=KanbanAssigneesResponse,
)
def list_household_assignees(
    household_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        rows = db.execute(
            select(
                UserDB.user_id,
                UserDB.username,
                UserDB.display_name,
            )
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id == household_id)
            .order_by(UserDB.username.asc())
        ).all()

        return KanbanAssigneesResponse(
            assignees=[
                KanbanAssignee(
                    user_id=str(row.user_id),
                    username=row.username,
                    display_name=row.display_name,
                )
                for row in rows
            ]
        )


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    payload: CreateTaskRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    task_name = payload.name.strip()
    task_status = payload.status.strip().lower()
    if not task_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task name is required",
        )
    if task_status not in ALLOWED_TASK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task status",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == payload.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        resolved_category_id = None
        if payload.category_id:
            category = db.scalar(
                select(Categories).where(Categories.category_id == payload.category_id)
            )
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category was not found",
                )
            if category.household_id != payload.household_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Category does not belong to the specified household",
                )
            resolved_category_id = category.category_id
        elif payload.category_name and payload.category_name.strip():
            normalized_category_name = payload.category_name.strip()
            category = db.scalar(
                select(Categories).where(
                    and_(
                        Categories.household_id == payload.household_id,
                        func.lower(Categories.name) == normalized_category_name.lower(),
                    )
                )
            )
            if not category:
                category = Categories(
                    household_id=payload.household_id,
                    name=normalized_category_name,
                )
                db.add(category)
                db.flush()

            resolved_category_id = category.category_id

        if payload.assigns_to:
            assignee = db.scalar(
                select(UserDB).where(UserDB.user_id == payload.assigns_to)
            )
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assignee was not found",
                )

            assignee_membership = db.scalar(
                select(UsersHouseholds).where(
                    and_(
                        UsersHouseholds.user_id == payload.assigns_to,
                        UsersHouseholds.household_id == payload.household_id,
                    )
                )
            )
            if assignee_membership is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assignee is not a member of the specified household",
                )

        started_at = payload.started_at
        complete_date = payload.complete_date
        now_utc = datetime.now(timezone.utc)
        if task_status == "in_progress" and started_at is None:
            started_at = now_utc
        if task_status == "done" and complete_date is None:
            complete_date = now_utc

        new_task = Tasks(
            household_id=payload.household_id,
            name=task_name,
            description=payload.description,
            status=task_status,
            priority=payload.priority,
            due_date=payload.due_date,
            category_id=resolved_category_id,
            assigns_to=payload.assigns_to,
            created_by=me.user_id,
            started_at=started_at,
            complete_date=complete_date,
        )
        db.add(new_task)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create task",
            ) from exc

        db.refresh(new_task)
        return TaskResponse(
            task_id=str(new_task.task_id),
            household_id=str(new_task.household_id),
            name=new_task.name,
            status=new_task.status,
            description=new_task.description,
            priority=new_task.priority,
            due_date=new_task.due_date,
            category_id=str(new_task.category_id) if new_task.category_id else None,
            assigns_to=str(new_task.assigns_to) if new_task.assigns_to else None,
            created_by=str(new_task.created_by) if new_task.created_by else None,
            started_at=new_task.started_at,
            complete_date=new_task.complete_date,
            created_at=new_task.created_at,
            updated_at=new_task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/status",
    response_model=UpdateTaskStatusResponse,
)
def update_task_status(
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    next_status = payload.status.strip().lower()
    if next_status not in ALLOWED_TASK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task status",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        now_utc = datetime.now(timezone.utc)
        previous_status = task.status
        task.status = next_status
        task.updated_at = now_utc
        if previous_status != next_status:
            task.order = None

        if next_status == "todo":
            task.started_at = None
            task.complete_date = None
        elif next_status == "in_progress":
            if task.started_at is None:
                task.started_at = now_utc
            task.complete_date = None
        elif next_status == "on_hold":
            task.complete_date = None
        elif next_status == "done" or next_status == "archive":
            if task.started_at is None:
                task.started_at = now_utc
            if task.complete_date is None:
                task.complete_date = now_utc

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task status",
            ) from exc

        db.refresh(task)
        return UpdateTaskStatusResponse(
            task_id=str(task.task_id),
            status=task.status,
            started_at=task.started_at,
            complete_date=task.complete_date,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/priority",
    response_model=UpdateTaskPriorityResponse,
)
def update_task_priority(
    task_id: UUID,
    payload: UpdateTaskPriorityRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    next_priority = payload.priority.strip().lower()
    if next_priority not in ALLOWED_TASK_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task priority",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        task.priority = next_priority
        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task priority",
            ) from exc

        db.refresh(task)
        return UpdateTaskPriorityResponse(
            task_id=str(task.task_id),
            priority=task.priority,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/due-date",
    response_model=UpdateTaskDueDateResponse,
)
def update_task_due_date(
    task_id: UUID,
    payload: UpdateTaskDueDateRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        task.due_date = payload.due_date
        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task due date",
            ) from exc

        db.refresh(task)
        return UpdateTaskDueDateResponse(
            task_id=str(task.task_id),
            due_date=task.due_date,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/assignee",
    response_model=UpdateTaskAssigneeResponse,
)
def update_task_assignee(
    task_id: UUID,
    payload: UpdateTaskAssigneeRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        next_assignee_id = payload.assigns_to
        next_assignee_name = None
        if next_assignee_id:
            assignee = db.scalar(
                select(UserDB).where(UserDB.user_id == next_assignee_id)
            )
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assignee was not found",
                )

            assignee_membership = db.scalar(
                select(UsersHouseholds).where(
                    and_(
                        UsersHouseholds.user_id == next_assignee_id,
                        UsersHouseholds.household_id == task.household_id,
                    )
                )
            )
            if assignee_membership is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assignee is not a member of the task household",
                )

            next_assignee_name = assignee.display_name or assignee.username

        task.assigns_to = next_assignee_id
        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task assignee",
            ) from exc

        db.refresh(task)
        return UpdateTaskAssigneeResponse(
            task_id=str(task.task_id),
            assigns_to=str(task.assigns_to) if task.assigns_to else None,
            assignee_name=next_assignee_name,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/description",
    response_model=UpdateTaskDescriptionResponse,
)
def update_task_description(
    task_id: UUID,
    payload: UpdateTaskDescriptionRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        next_description = (
            payload.description.strip()
            if isinstance(payload.description, str)
            else None
        )
        task.description = next_description or None
        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task description",
            ) from exc

        db.refresh(task)
        return UpdateTaskDescriptionResponse(
            task_id=str(task.task_id),
            description=task.description,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/category",
    response_model=UpdateTaskCategoryResponse,
)
def update_task_category(
    task_id: UUID,
    payload: UpdateTaskCategoryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        category_name = payload.category_name.strip() if payload.category_name else ""
        if not category_name:
            task.category_id = None
            task.updated_at = datetime.now(timezone.utc)
            resolved_category_name = None
        else:
            category = db.scalar(
                select(Categories).where(
                    and_(
                        Categories.household_id == task.household_id,
                        func.lower(Categories.name) == category_name.lower(),
                    )
                )
            )
            if not category:
                category = Categories(
                    household_id=task.household_id,
                    name=category_name,
                )
                db.add(category)
                db.flush()

            task.category_id = category.category_id
            task.updated_at = datetime.now(timezone.utc)
            resolved_category_name = category.name

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task category",
            ) from exc

        db.refresh(task)
        return UpdateTaskCategoryResponse(
            task_id=str(task.task_id),
            category_id=str(task.category_id) if task.category_id else None,
            category_name=resolved_category_name,
            updated_at=task.updated_at,
        )


@router.patch(
    "/tasks/{task_id}/name",
    response_model=UpdateTaskNameResponse,
)
def update_task_name(
    task_id: UUID,
    payload: UpdateTaskNameRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    next_name = payload.name.strip()
    if not next_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task name is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        task.name = next_name
        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task name",
            ) from exc

        db.refresh(task)
        return UpdateTaskNameResponse(
            task_id=str(task.task_id),
            name=task.name,
            updated_at=task.updated_at,
        )


@router.delete(
    "/tasks/{task_id}",
    response_model=DeleteTaskResponse,
)
def delete_task(
    task_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        task = db.scalar(select(Tasks).where(Tasks.task_id == task_id))
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task was not found",
            )

        requester_membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == me.user_id,
                    UsersHouseholds.household_id == task.household_id,
                )
            )
        )
        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the task household",
            )

        db.delete(task)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to delete task",
            ) from exc

        return DeleteTaskResponse(task_id=str(task_id), deleted=True)


@router.patch(
    "/tasks/reorder",
    response_model=ReorderTasksResponse,
)
def reorder_tasks(
    payload: ReorderTasksRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    target_status = payload.status.strip().lower()
    if target_status not in ALLOWED_TASK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task status",
        )

    ordered_ids_raw = [
        task_id.strip() for task_id in payload.ordered_task_ids if task_id
    ]
    if not ordered_ids_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_task_ids must not be empty",
        )
    if len(ordered_ids_raw) != len(set(ordered_ids_raw)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_task_ids must be unique",
        )

    try:
        ordered_ids = [UUID(task_id) for task_id in ordered_ids_raw]
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_task_ids contains an invalid UUID",
        ) from exc

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not me:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        tasks = (
            db.execute(
                select(Tasks)
                .join(
                    UsersHouseholds,
                    and_(
                        UsersHouseholds.household_id == Tasks.household_id,
                        UsersHouseholds.user_id == me.user_id,
                    ),
                )
                .where(
                    Tasks.task_id.in_(ordered_ids),
                    Tasks.status == target_status,
                )
            )
            .scalars()
            .all()
        )
        if len(tasks) != len(ordered_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All tasks must exist, belong to your household, and match status",
            )

        task_by_id = {task.task_id: task for task in tasks}
        now_utc = datetime.now(timezone.utc)
        for index, task_id in enumerate(ordered_ids):
            task = task_by_id[task_id]
            task.order = index
            task.updated_at = now_utc

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to reorder tasks",
            ) from exc

        return ReorderTasksResponse(
            status=target_status,
            updated_count=len(ordered_ids),
            updated_at=now_utc,
        )
