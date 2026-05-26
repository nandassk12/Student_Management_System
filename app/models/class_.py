"""
app/models/class_.py
─────────────────────
Classes table — e.g. "AIML 2023" — a batch of students in a department.
Note: named `class_` to avoid collision with Python's built-in `class`.
"""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Class_(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relationships ─────────────────────────────────
    department: Mapped["Department"] = relationship(  # noqa: F821
        "Department", back_populates="classes", lazy="selectin"
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(  # noqa: F821
        "Enrollment", back_populates="class_", lazy="selectin"
    )
    student_profiles: Mapped[list["StudentProfile"]] = relationship(  # noqa: F821
        "StudentProfile", back_populates="class_", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Class_ id={self.id} name={self.name!r} year={self.year}>"
