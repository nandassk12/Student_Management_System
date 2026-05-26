"""
app/schemas/fee.py
──────────────────
Pydantic v2 schemas for Fee endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserOut

# Allowed fee types and status constants matching database validation
FeeType = Literal["tuition", "hostel", "exam", "library"]
FeeStatus = Literal["paid", "pending", "overdue"]


class FeeCreate(BaseModel):
    """Admin creates a fee obligation for a student."""

    student_id: int
    amount: float = Field(..., description="Fee amount must be greater than 0")
    fee_type: FeeType
    status: FeeStatus = "pending"
    due_date: datetime.date

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be strictly greater than 0")
        return round(v, 2)


class FeeUpdate(BaseModel):
    """Admin updates fee details."""

    amount: float | None = Field(None, description="Fee amount must be greater than 0")
    fee_type: FeeType | None = None
    status: FeeStatus | None = None
    due_date: datetime.date | None = None
    paid_date: datetime.date | None = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive_optional(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Amount must be strictly greater than 0")
        return round(v, 2) if v is not None else None


class FeePayment(BaseModel):
    """Body schema for recording a payment."""

    paid_date: datetime.date | None = Field(
        None, description="Defaults to current date if not provided"
    )


class FeeOut(BaseModel):
    """Response schema containing full fee details."""

    id: int
    student_id: int
    amount: float
    fee_type: FeeType
    status: FeeStatus
    due_date: datetime.date
    paid_date: datetime.date | None
    created_at: datetime.datetime

    student: UserOut

    model_config = {"from_attributes": True}
