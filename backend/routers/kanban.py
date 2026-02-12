from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from helpers import get_current_user, get_session_local
from models import Categories, Tasks, User, UserDB

router = APIRouter(
    prefix="/api/kanban",
    tags=["kanban"],
)


class KanbanTask(BaseModel):
    task_id: str
    name: str
    status: str
    due_date: datetime | None = None
    assignee_name: str | None = None
    category_name: str | None = None


class KanbanTasksResponse(BaseModel):
    tasks: list[KanbanTask]


@router.get("/tasks", response_model=KanbanTasksResponse)
def list_kamban_tasks(_: User = Depends(get_current_user)):
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        rows = db.execute(
            select(
                Tasks.task_id,
                Tasks.name,
                Tasks.status,
                Tasks.due_date,
                UserDB.username.label("assignee_name"),
                Categories.name.label("category_name"),
            )
            .outerjoin(UserDB, Tasks.assigns_to == UserDB.user_id)
            .outerjoin(Categories, Tasks.category_id == Categories.category_id)
            .order_by(Tasks.created_at.desc())
        ).all()

    return KanbanTasksResponse(
        tasks=[
            KanbanTask(
                task_id=str(row.task_id),
                name=row.name,
                status=row.status,
                due_date=row.due_date,
                assignee_name=row.assignee_name,
                category_name=row.category_name,
            )
            for row in rows
        ]
    )
