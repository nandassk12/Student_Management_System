"""
app/models/department.py
────────────────────────
Departments table (e.g. AIML, CS, ECE).
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)

    # ── Relationships ─────────────────────────────────
    courses: Mapped[list["Course"]] = relationship(  # noqa: F821
        "Course", back_populates="department", lazy="selectin"
    )
    classes: Mapped[list["Class_"]] = relationship(  # noqa: F821
        "Class_", back_populates="department", lazy="selectin"
    )
    student_profiles: Mapped[list["StudentProfile"]] = relationship(  # noqa: F821
        "StudentProfile", back_populates="department", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Department id={self.id} code={self.code!r}>"
