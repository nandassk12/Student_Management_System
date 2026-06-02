"""
app/models/teacher_leave.py
───────────────────────────
Leave requests table for teachers — teacher submits a leave request,
admin reviews and approves/rejects it.
"""

import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid leave request statuses
VALID_LEAVE_STATUSES = {"pending", "approved", "rejected"}


class TeacherLeaveRequest(Base):
    __tablename__ = "teacher_leave_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Admin assigned to review this request
    admin_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    reason: Mapped[str] = mapped_column(Text, nullable=False)

    from_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    to_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    # "pending" | "approved" | "rejected"
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("status")
    def validate_status(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_LEAVE_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. "
                f"Must be one of: {sorted(VALID_LEAVE_STATUSES)}"
            )
        return normalized

    @validates("reason")
    def validate_reason(self, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Reason cannot be empty")
        if len(value) < 10:
            raise ValueError("Reason must be at least 10 characters")
        return value

    # ── Convenience property ──────────────────────────
    @property
    def duration_days(self) -> int:
        """Number of calendar days the leave spans (inclusive)."""
        if self.from_date and self.to_date:
            return (self.to_date - self.from_date).days + 1
        return 0

    # ── Relationships ──────────────────────────────────
    teacher: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[teacher_id],
        lazy="selectin",
    )
    admin: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[admin_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<TeacherLeaveRequest id={self.id} teacher={self.teacher_id} "
            f"admin={self.admin_id} status={self.status!r} "
            f"{self.from_date}→{self.to_date}>"
        )
