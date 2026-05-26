"""
app/schemas/timetable.py
─────────────────────────
Pydantic v2 schemas for Timetable endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.schemas.class_ import ClassOut
from app.schemas.course import CourseOut
from app.schemas.user import UserOut

# Valid weekdays as a Literal for Swagger enum dropdown
WeekDay = Literal[
    "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday",
]


class TimetableCreate(BaseModel):
    """Admin creates a timetable slot."""

    class_id: int
    course_id: int
    teacher_id: int
    day: WeekDay
    start_time: datetime.time
    end_time: datetime.time
    room: str

    @field_validator("day")
    @classmethod
    def normalise_day(cls, v: str) -> str:
        """Accept any case — normalise to title case."""
        return v.strip().capitalize()

    @field_validator("room")
    @classmethod
    def room_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Room cannot be empty")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "TimetableCreate":
        """Ensure end_time is strictly after start_time."""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TimetableOut(BaseModel):
    """Full timetable slot returned to callers."""

    id: int
    class_id: int
    course_id: int
    teacher_id: int
    day: WeekDay
    start_time: datetime.time
    end_time: datetime.time
    room: str

    class_: ClassOut
    course: CourseOut
    teacher: UserOut

    model_config = {"from_attributes": True}
