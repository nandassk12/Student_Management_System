"""
app/schemas/leave.py
────────────────────
Pydantic v2 schemas for Leave Request endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.user import UserOut

# Allowed leave statuses matching database validation
LeaveStatus = Literal["pending", "approved", "rejected"]


class LeaveCreate(BaseModel):
    """Student submits a new leave request."""

    teacher_id: int = Field(..., description="ID of the teacher reviewing the request")
    reason: str = Field(..., min_length=10, description="Detailed reason for leave request")
    from_date: datetime.date
    to_date: datetime.date

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def to_date_must_be_after_or_equal_to_from_date(self) -> "LeaveCreate":
        if self.to_date < self.from_date:
            raise ValueError("to_date cannot be before from_date")
        return self


class LeaveReview(BaseModel):
    """Teacher approves or rejects a leave request."""

    status: Literal["approved", "rejected"]


class LeaveOut(BaseModel):
    """Response schema containing full leave request details."""

    id: int
    student_id: int
    teacher_id: int
    reason: str
    from_date: datetime.date
    to_date: datetime.date
    status: LeaveStatus
    created_at: datetime.datetime
    duration_days: int

    student: UserOut
    teacher: UserOut

    model_config = {"from_attributes": True}


class LeaveBalanceOut(BaseModel):
    """Leave balance info returned to callers."""

    total_allowed: int
    used: int
    remaining: int
    semester: int

