from pydantic import BaseModel


class CalendarEvent(BaseModel):
    id: str
    task_id: str
    date: str
    title: str
    description: str | None = None
    household_id: str
    household_name: str | None = None
    person: str | None = None
    category_name: str | None = None
    recurrence_enabled: bool = False
    recurrence_frequency: str | None = None
    recurrence_interval: int | None = None
    is_projected: bool = False


class CalendarEventsResponse(BaseModel):
    startDate: str
    today: str
    monthLabel: str
    events: list[CalendarEvent]
    

class CalendarRangeEventsResponse(BaseModel):
    fromDate: str
    toDate: str
    today: str
    events: list[CalendarEvent]
