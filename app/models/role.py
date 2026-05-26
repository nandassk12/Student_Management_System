"""
app/models/role.py
──────────────────
Roles table — three fixed roles: admin, teacher, student.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # ── Relationships ─────────────────────────────────
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        "User", back_populates="role", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r}>"
