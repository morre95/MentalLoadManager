from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.v1.helpers import get_session_local
from app.v1.models import Categories, Tasks, UserEmail

from ..input_validation import (
    CATEGORY_NAME_MAX_LENGTH,
    TASK_NAME_MAX_LENGTH,
    sanitize_description,
    validate_optional_name,
    validate_required_name,
)
from .repository import (
    count_tasks_for_member,
    find_membership,
    get_generated_recurring_child,
    get_assignee_by_id,
    get_category_by_household_and_id,
    get_category_by_id,
    get_category_by_name,
    get_task_by_id,
    get_user_by_username,
    list_categories_for_household,
    list_assignees_for_household,
    list_generated_recurring_children,
    list_reorder_tasks,
    list_tasks_for_member,
)
from .schemas import (
    CreateHouseholdCategoryRequest,
    CreateTaskRequest,
    DeleteHouseholdCategoryResponse,
    DeleteTaskResponse,
    HouseholdCategoriesResponse,
    HouseholdCategory,
    KanbanAssignee,
    KanbanAssigneesResponse,
    KanbanTask,
    KanbanTasksResponse,
    ReorderTasksRequest,
    ReorderTasksResponse,
    SkipTaskOccurrenceRequest,
    SkipTaskOccurrenceResponse,
    TaskResponse,
    UpdateTaskAssigneeRequest,
    UpdateTaskAssigneeResponse,
    UpdateTaskCategoryRequest,
    UpdateTaskCategoryResponse,
    UpdateTaskDescriptionRequest,
    UpdateTaskDescriptionResponse,
    UpdateTaskDueDateRequest,
    UpdateTaskDueDateResponse,
    UpdateTaskRecurrenceRequest,
    UpdateTaskRecurrenceResponse,
    UpdateTaskNameRequest,
    UpdateTaskNameResponse,
    UpdateTaskPriorityRequest,
    UpdateTaskPriorityResponse,
    UpdateTaskStatusRequest,
    UpdateTaskStatusResponse,
)

ALLOWED_TASK_STATUSES = {"todo", "in_progress", "done", "on_hold", "archive"}
ALLOWED_TASK_PRIORITIES = {"low", "medium", "high"}
ALLOWED_RECURRENCE_FREQUENCIES = {"daily", "weekly", "monthly"}
ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
PRIVILEGED_HOUSEHOLD_ROLES = {ROLE_OWNER, ROLE_ADMIN}


def _normalize_recurrence_frequency(value: str | None) -> str | None:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return None
    if normalized not in ALLOWED_RECURRENCE_FREQUENCIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recurrence frequency",
        )
    return normalized


def _add_months(source: datetime, months: int) -> datetime:
    total_month = (source.month - 1) + months
    year = source.year + total_month // 12
    month = (total_month % 12) + 1
    day = min(source.day, monthrange(year, month)[1])
    return source.replace(year=year, month=month, day=day)


def _calculate_next_due_date(
    due_date: datetime, recurrence_frequency: str, recurrence_interval: int
) -> datetime:
    if recurrence_frequency == "daily":
        return due_date + timedelta(days=recurrence_interval)
    if recurrence_frequency == "weekly":
        return due_date + timedelta(weeks=recurrence_interval)
    return _add_months(due_date, recurrence_interval)


def _get_recurrence_exceptions(task: Tasks) -> set[date]:
    raw_dates = task.recurrence_exceptions or []
    return {value for value in raw_dates if value is not None}


def _find_next_unskipped_due_date(task: Tasks) -> datetime:
    if not task.due_date or not task.recurrence_frequency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not configured for recurrence",
        )

    next_due_date = task.due_date
    recurrence_interval = task.recurrence_interval or 1
    exceptions = _get_recurrence_exceptions(task)

    for _ in range(366):
        if next_due_date.date() not in exceptions:
            return next_due_date
        next_due_date = _calculate_next_due_date(
            next_due_date,
            task.recurrence_frequency,
            recurrence_interval,
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Could not resolve the next recurrence date",
    )


def _maybe_spawn_next_recurring_task(db, task: Tasks, now_utc: datetime) -> None:
    if (
        not task.recurrence_enabled
        or not task.recurrence_frequency
        or not task.due_date
    ):
        return
    if get_generated_recurring_child(db, task.task_id):
        return

    next_due_date = _calculate_next_due_date(
        task.due_date,
        task.recurrence_frequency,
        task.recurrence_interval or 1,
    )

    if task.recurrence_end_date and next_due_date.date() > task.recurrence_end_date:
        return

    next_task = Tasks(
        household_id=task.household_id,
        name=task.name,
        description=task.description,
        status="todo",
        priority=task.priority,
        due_date=next_due_date,
        recurrence_enabled=True,
        recurrence_frequency=task.recurrence_frequency,
        recurrence_interval=task.recurrence_interval or 1,
        recurrence_end_date=task.recurrence_end_date,
        recurrence_parent_task_id=task.task_id,
        category_id=task.category_id,
        assigns_to=task.assigns_to,
        created_by=task.created_by,
        updated_at=now_utc,
    )
    db.add(next_task)


def _get_me(db, current_user: UserEmail):
    me = get_user_by_username(db, current_user.username)
    if not me:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return me


def _require_membership(db, user_id: UUID, household_id: UUID, detail: str):
    requester_membership = find_membership(db, user_id, household_id)
    if requester_membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def _require_privileged_membership(db, user_id: UUID, household_id: UUID):
    membership = find_membership(db, user_id, household_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of the specified household",
        )
    if membership.role not in PRIVILEGED_HOUSEHOLD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can manage categories in this household",
        )


def list_household_categories(
    household_id: UUID,
    current_user: UserEmail,
) -> HouseholdCategoriesResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        _require_membership(
            db,
            me.user_id,
            household_id,
            "User is not a member of the specified household",
        )

        rows = list_categories_for_household(db, household_id)

        return HouseholdCategoriesResponse(
            categories=[
                HouseholdCategory(
                    category_id=str(row.category_id),
                    name=row.name,
                )
                for row in rows
            ]
        )


def create_household_category(
    household_id: UUID,
    payload: CreateHouseholdCategoryRequest,
    current_user: UserEmail,
) -> HouseholdCategory:
    category_name = validate_required_name(
        payload.name,
        field_name="Category name",
        max_length=CATEGORY_NAME_MAX_LENGTH,
    )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        _require_privileged_membership(db, me.user_id, household_id)

        category = get_category_by_name(db, household_id, category_name)
        if not category:
            category = Categories(
                household_id=household_id,
                name=category_name,
            )
            db.add(category)

            try:
                db.commit()
            except IntegrityError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Unable to create household category",
                ) from exc

            db.refresh(category)

        return HouseholdCategory(
            category_id=str(category.category_id),
            name=category.name,
        )


def delete_household_category(
    household_id: UUID,
    category_id: UUID,
    current_user: UserEmail,
) -> DeleteHouseholdCategoryResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        _require_privileged_membership(db, me.user_id, household_id)

        category = get_category_by_household_and_id(db, household_id, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category was not found",
            )

        db.delete(category)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to delete household category",
            ) from exc

        return DeleteHouseholdCategoryResponse(
            category_id=str(category_id),
            deleted=True,
        )


def _get_task_with_membership(db, task_id: UUID, me_user_id: UUID):
    task = get_task_by_id(db, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task was not found",
        )

    _require_membership(
        db,
        me_user_id,
        task.household_id,
        "User is not a member of the task household",
    )
    return task


def list_kanban_tasks(
    household_id: UUID | None,
    limit: int,
    offset: int,
    current_user: UserEmail,
) -> KanbanTasksResponse:
    normalized_limit = max(1, min(limit, 5000))
    normalized_offset = max(0, offset)
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)

        if household_id:
            _require_membership(
                db,
                me.user_id,
                household_id,
                "User is not a member of the specified household",
            )

        total = count_tasks_for_member(db, me.user_id, household_id)
        rows = list_tasks_for_member(
            db,
            me.user_id,
            household_id,
            limit=normalized_limit,
            offset=normalized_offset,
        )

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
                recurrence_enabled=row.recurrence_enabled,
                recurrence_frequency=row.recurrence_frequency,
                recurrence_interval=row.recurrence_interval,
                assignee_user_id=str(row.assignee_user_id)
                if row.assignee_user_id
                else None,
                assignee_name=row.assignee_name,
                category_name=row.category_name,
            )
            for row in rows
        ],
        total=total,
        limit=normalized_limit,
        offset=normalized_offset,
    )


def list_household_assignees(
    household_id: UUID,
    current_user: UserEmail,
) -> KanbanAssigneesResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)

        _require_membership(
            db,
            me.user_id,
            household_id,
            "User is not a member of the specified household",
        )

        rows = list_assignees_for_household(db, household_id)

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


def create_task(payload: CreateTaskRequest, current_user: UserEmail) -> TaskResponse:
    task_name = validate_required_name(
        payload.name,
        field_name="Task name",
        max_length=TASK_NAME_MAX_LENGTH,
    )
    task_status = payload.status.strip().lower()
    recurrence_frequency = _normalize_recurrence_frequency(payload.recurrence_frequency)
    recurrence_interval = payload.recurrence_interval or 1
    task_description = sanitize_description(payload.description)
    category_name = validate_optional_name(
        payload.category_name,
        field_name="Category name",
        max_length=CATEGORY_NAME_MAX_LENGTH,
    )
    if task_status not in ALLOWED_TASK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task status",
        )
    if recurrence_frequency and payload.due_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recurring tasks require a due date",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)

        _require_membership(
            db,
            me.user_id,
            payload.household_id,
            "User is not a member of the specified household",
        )

        resolved_category_id = None
        if payload.category_id:
            category = get_category_by_id(db, payload.category_id)
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
        elif category_name:
            category = get_category_by_name(
                db,
                payload.household_id,
                category_name,
            )
            if not category:
                category = Categories(
                    household_id=payload.household_id,
                    name=category_name,
                )
                db.add(category)
                db.flush()

            resolved_category_id = category.category_id

        if payload.assigns_to:
            assignee = get_assignee_by_id(db, payload.assigns_to)
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assignee was not found",
                )

            assignee_membership = find_membership(
                db,
                payload.assigns_to,
                payload.household_id,
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
            description=task_description,
            status=task_status,
            priority=payload.priority,
            due_date=payload.due_date,
            recurrence_enabled=bool(recurrence_frequency),
            recurrence_frequency=recurrence_frequency,
            recurrence_interval=recurrence_interval if recurrence_frequency else None,
            recurrence_end_date=payload.recurrence_end_date if recurrence_frequency else None,
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
            recurrence_enabled=new_task.recurrence_enabled,
            recurrence_frequency=new_task.recurrence_frequency,
            recurrence_interval=new_task.recurrence_interval,
            recurrence_end_date=new_task.recurrence_end_date,
            category_id=str(new_task.category_id) if new_task.category_id else None,
            assigns_to=str(new_task.assigns_to) if new_task.assigns_to else None,
            created_by=str(new_task.created_by) if new_task.created_by else None,
            started_at=new_task.started_at,
            complete_date=new_task.complete_date,
            created_at=new_task.created_at,
            updated_at=new_task.updated_at,
        )


def update_task_status(
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    current_user: UserEmail,
) -> UpdateTaskStatusResponse:
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
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

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
            if previous_status not in {"done", "archive"}:
                _maybe_spawn_next_recurring_task(db, task, now_utc)

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


def update_task_priority(
    task_id: UUID,
    payload: UpdateTaskPriorityRequest,
    current_user: UserEmail,
) -> UpdateTaskPriorityResponse:
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
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

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


def update_task_due_date(
    task_id: UUID,
    payload: UpdateTaskDueDateRequest,
    current_user: UserEmail,
) -> UpdateTaskDueDateResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

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


def update_task_recurrence(
    task_id: UUID,
    payload: UpdateTaskRecurrenceRequest,
    current_user: UserEmail,
) -> UpdateTaskRecurrenceResponse:
    recurrence_frequency = _normalize_recurrence_frequency(payload.recurrence_frequency)
    recurrence_interval = payload.recurrence_interval or 1

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

        if recurrence_frequency and task.due_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recurring tasks require a due date",
            )

        task.recurrence_enabled = bool(recurrence_frequency)
        task.recurrence_frequency = recurrence_frequency
        task.recurrence_interval = recurrence_interval if recurrence_frequency else None
        task.recurrence_end_date = payload.recurrence_end_date if recurrence_frequency else None
        task.updated_at = datetime.now(timezone.utc)

        if not recurrence_frequency:
            for child_task in list_generated_recurring_children(db, task.task_id):
                child_task.recurrence_parent_task_id = None

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update task recurrence",
            ) from exc

        db.refresh(task)
        return UpdateTaskRecurrenceResponse(
            task_id=str(task.task_id),
            recurrence_enabled=task.recurrence_enabled,
            recurrence_frequency=task.recurrence_frequency,
            recurrence_interval=task.recurrence_interval,
            recurrence_end_date=task.recurrence_end_date,
            updated_at=task.updated_at,
        )


def skip_task_occurrence(
    task_id: UUID,
    payload: SkipTaskOccurrenceRequest,
    current_user: UserEmail,
) -> SkipTaskOccurrenceResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

        if (
            not task.recurrence_enabled
            or not task.recurrence_frequency
            or not task.due_date
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only recurring tasks can skip one occurrence",
            )

        occurrence_date = payload.occurrence_date
        recurrence_exceptions = _get_recurrence_exceptions(task)
        recurrence_exceptions.add(occurrence_date)
        task.recurrence_exceptions = sorted(recurrence_exceptions)

        if occurrence_date == task.due_date.date():
            task.due_date = _find_next_unskipped_due_date(task)

        task.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to skip task occurrence",
            ) from exc

        db.refresh(task)
        return SkipTaskOccurrenceResponse(
            task_id=str(task.task_id),
            skipped_occurrence_date=occurrence_date,
            next_due_date=task.due_date,
            updated_at=task.updated_at,
        )


def update_task_assignee(
    task_id: UUID,
    payload: UpdateTaskAssigneeRequest,
    current_user: UserEmail,
) -> UpdateTaskAssigneeResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

        next_assignee_id = payload.assigns_to
        next_assignee_name = None
        if next_assignee_id:
            assignee = get_assignee_by_id(db, next_assignee_id)
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assignee was not found",
                )

            assignee_membership = find_membership(
                db, next_assignee_id, task.household_id
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


def update_task_description(
    task_id: UUID,
    payload: UpdateTaskDescriptionRequest,
    current_user: UserEmail,
) -> UpdateTaskDescriptionResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

        next_description = sanitize_description(payload.description)
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


def update_task_category(
    task_id: UUID,
    payload: UpdateTaskCategoryRequest,
    current_user: UserEmail,
) -> UpdateTaskCategoryResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

        category_name = (
            validate_optional_name(
                payload.category_name,
                field_name="Category name",
                max_length=CATEGORY_NAME_MAX_LENGTH,
            )
            or ""
        )
        if not category_name:
            task.category_id = None
            task.updated_at = datetime.now(timezone.utc)
            resolved_category_name = None
        else:
            category = get_category_by_name(db, task.household_id, category_name)
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


def update_task_name(
    task_id: UUID,
    payload: UpdateTaskNameRequest,
    current_user: UserEmail,
) -> UpdateTaskNameResponse:
    next_name = validate_required_name(
        payload.name,
        field_name="Task name",
        max_length=TASK_NAME_MAX_LENGTH,
    )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

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


def delete_task(task_id: UUID, current_user: UserEmail) -> DeleteTaskResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        me = _get_me(db, current_user)
        task = _get_task_with_membership(db, task_id, me.user_id)

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


def reorder_tasks(
    payload: ReorderTasksRequest,
    current_user: UserEmail,
) -> ReorderTasksResponse:
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
        me = _get_me(db, current_user)

        tasks = list_reorder_tasks(db, me.user_id, ordered_ids, target_status)
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
