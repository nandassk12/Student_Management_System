"""
app/schemas/teacher_leave.py
────────────────────────────
Pydantic v2 schemas for Teacher Leave Request endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.user import UserOut

# Allowed leave statuses matching database validation
LeaveStatus = Literal["pending", "approved", "rejected"]


class TeacherLeaveCreate(BaseModel):
    """Teacher submits a new leave request."""

    admin_id: int = Field(..., description="ID of the admin reviewing the request")
    reason: str = Field(..., min_length=10, description="Detailed reason for leave request")
    from_date: datetime.date
    to_date: datetime.date

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def to_date_must_be_after_or_equal_to_from_date(self) -> "TeacherLeaveCreate":
        if self.to_date < self.from_date:
            raise ValueError("to_date cannot be before from_date")
        return self


class TeacherLeaveReview(BaseModel):
    """Admin approves or rejects a leave request."""

    status: Literal["approved", "rejected"]


class TeacherLeaveOut(BaseModel):
    """Response schema containing full leave request details."""

    id: int
    teacher_id: int
    admin_id: int
    reason: str
    from_date: datetime.date
    to_date: datetime.date
    status: LeaveStatus
    created_at: datetime.datetime
    duration_days: int

    teacher: UserOut
    admin: UserOut

    model_config = {"from_attributes": True}
