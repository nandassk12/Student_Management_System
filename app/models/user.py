"""
app/models/user.py
──────────────────
Users table — stores credentials, role FK, and active status.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────
    role: Mapped["Role"] = relationship(  # noqa: F821
        "Role", back_populates="users", lazy="selectin"
    )
    student_profile: Mapped["StudentProfile"] = relationship(  # noqa: F821
        "StudentProfile", back_populates="user", uselist=False, lazy="selectin"
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(  # noqa: F821
        "Enrollment", back_populates="student", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role_id={self.role_id}>"
