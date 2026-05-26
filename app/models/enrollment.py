"""
app/models/enrollment.py
─────────────────────────
Enrollment table — maps a student (user) to a class.
"""

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Enrollment(Base):
    __tablename__ = "enrollment"

    # Prevent duplicate enrollments for same student + class
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", name="uq_enrollment_student_class"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )

    # ── Relationships ─────────────────────────────────
    student: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="enrollments", lazy="selectin"
    )
    class_: Mapped["Class_"] = relationship(  # noqa: F821
        "Class_", back_populates="enrollments", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Enrollment id={self.id} student={self.student_id} class={self.class_id}>"
