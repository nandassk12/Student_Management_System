"""
app/schemas/attendance.py
──────────────────────────
Pydantic v2 schemas for Attendance endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.user import UserOut
from app.schemas.course import CourseOut
from app.schemas.class_ import ClassOut

# Enforce only valid status literals at the schema level too
AttendanceStatus = Literal["present", "absent", "late"]


class AttendanceCreate(BaseModel):
    """Teacher marks attendance for a student."""

    student_id: int
    course_id: int
    class_id: int
    date: datetime.date
    status: AttendanceStatus

    @field_validator("date")
    @classmethod
    def date_not_future(cls, v: datetime.date) -> datetime.date:
        if v > datetime.date.today():
            raise ValueError("Attendance date cannot be in the future")
        return v


class AttendanceOut(BaseModel):
    """Full attendance record returned to callers."""

    id: int
    student_id: int
    course_id: int
    class_id: int
    date: datetime.date
    status: AttendanceStatus
    marked_by: int
    created_at: datetime.datetime

    student: UserOut
    course: CourseOut
    class_: ClassOut
    marker: UserOut

    model_config = {"from_attributes": True}


class AttendancePercentage(BaseModel):
    """Attendance percentage per course for a student."""

    course_id: int
    course_name: str
    course_code: str
    total_classes: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_percentage: float  # (present + late) / total * 100


class AttendancePrediction(BaseModel):
    """Predictive attendance stats showing classes needed to hit 75%."""

    course: str
    current_percentage: float
    classes_attended: int
    total_classes: int
    needed_for_75: int
    status: Literal["Safe", "At Risk", "Detained"]

