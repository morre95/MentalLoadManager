from pydantic import BaseModel


class CalendarEvent(BaseModel):
    id: str
    date: str
    title: str
    household_id: str
    household_name: str | None = None
    person: str | None = None


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
