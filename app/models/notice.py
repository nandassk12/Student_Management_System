"""
app/models/notice.py
────────────────────
Notice board table — stores public notices posted by admins or teachers,
targeting specific roles or optionally specific classes.
"""

import datetime
from typing import Literal

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid target roles for a notice
VALID_TARGET_ROLES = {"all", "student", "teacher"}


class Notice(Base):
    __tablename__ = "notice_board"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Author of the notice (typically admin or teacher)
    author_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Role targeted by this notice: "all" | "student" | "teacher"
    target_role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="all"
    )

    # Optional filter: notice is only relevant for a specific class (batch)
    class_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("target_role")
    def validate_target_role(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_TARGET_ROLES:
            raise ValueError(
                f"Invalid target_role '{value}'. "
                f"Must be one of: {sorted(VALID_TARGET_ROLES)}"
            )
        return normalized

    @validates("title")
    def validate_title(self, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty")
        if len(value) < 3:
            raise ValueError("Title must be at least 3 characters")
        if len(value) > 200:
            raise ValueError("Title cannot exceed 200 characters")
        return value

    @validates("content")
    def validate_content(self, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Content cannot be empty")
        return value

    # ── Relationships ──────────────────────────────────
    author: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[author_id],
        lazy="selectin",
    )
    class_: Mapped["Class_"] = relationship(  # noqa: F821
        "Class_",
        foreign_keys=[class_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Notice id={self.id} author={self.author_id} "
            f"target_role={self.target_role!r} class={self.class_id} "
            f"title={self.title!r}>"
        )
