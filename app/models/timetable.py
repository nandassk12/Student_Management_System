"""
app/models/timetable.py
────────────────────────
Timetable table — weekly schedule mapping a class + course + teacher
to a specific day, time slot, and room.
"""

import datetime

from sqlalchemy import ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid weekday names
VALID_DAYS = {
    "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday",
}


class Timetable(Base):
    __tablename__ = "timetable"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False, index=True
    )
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # "Monday" | "Tuesday" | ... | "Sunday"
    day: Mapped[str] = mapped_column(String(10), nullable=False)

    start_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)

    # Room / hall identifier e.g. "A101", "Lab-3"
    room: Mapped[str] = mapped_column(String(50), nullable=False)

    # ── ORM Validators ────────────────────────────────
    @validates("day")
    def validate_day(self, key: str, value: str) -> str:
        normalized = value.strip().capitalize()
        if normalized not in VALID_DAYS:
            raise ValueError(
                f"Invalid day '{value}'. Must be one of: {sorted(VALID_DAYS)}"
            )
        return normalized

    @validates("end_time")
    def validate_end_time(self, key: str, value: datetime.time) -> datetime.time:
        # start_time may not be set yet during __init__ — guard with getattr
        start = getattr(self, "start_time", None)
        if start is not None and value <= start:
            raise ValueError("end_time must be after start_time")
        return value

    # ── Relationships ──────────────────────────────────
    class_: Mapped["Class_"] = relationship(  # noqa: F821
        "Class_",
        lazy="selectin",
    )
    course: Mapped["Course"] = relationship(  # noqa: F821
        "Course",
        lazy="selectin",
    )
    teacher: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[teacher_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Timetable id={self.id} class={self.class_id} "
            f"course={self.course_id} day={self.day!r} "
            f"{self.start_time}–{self.end_time}>"
        )
