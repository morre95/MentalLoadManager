from pydantic import BaseModel


class CalendarEvent(BaseModel):
    id: str
    date: str
    title: str
    person: str | None = None


class CalendarEventsResponse(BaseModel):
    startDate: str
    today: str
    monthLabel: str
    events: list[CalendarEvent]
