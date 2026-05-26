"""
app/models/fee.py
──────────────────
Fees table — tracks financial obligations per student.
Each record represents one fee item (tuition, hostel, exam, library).
"""

import datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid fee types
VALID_FEE_TYPES = {"tuition", "hostel", "exam", "library"}

# Valid payment statuses
VALID_FEE_STATUSES = {"paid", "pending", "overdue"}


class Fee(Base):
    __tablename__ = "fees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    amount: Mapped[float] = mapped_column(Float, nullable=False)

    # "tuition" | "hostel" | "exam" | "library"
    fee_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # "paid" | "pending" | "overdue"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    paid_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("fee_type")
    def validate_fee_type(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_FEE_TYPES:
            raise ValueError(
                f"Invalid fee_type '{value}'. Must be one of: {sorted(VALID_FEE_TYPES)}"
            )
        return normalized

    @validates("status")
    def validate_status(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_FEE_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. Must be one of: {sorted(VALID_FEE_STATUSES)}"
            )
        return normalized

    @validates("amount")
    def validate_amount(self, key: str, value: float) -> float:
        if value <= 0:
            raise ValueError("Fee amount must be greater than zero")
        return round(value, 2)

    # ── Relationships ──────────────────────────────────
    student: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[student_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Fee id={self.id} student={self.student_id} "
            f"type={self.fee_type!r} amount={self.amount} "
            f"status={self.status!r} due={self.due_date}>"
        )
