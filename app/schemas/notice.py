"""
app/schemas/notice.py
──────────────────────
Pydantic v2 schemas for Notice Board endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserOut
from app.schemas.class_ import ClassOut

# Valid notice target roles matching database validation
NoticeTargetRole = Literal["all", "student", "teacher"]


class NoticeCreate(BaseModel):
    """Admin or teacher posts a new notice."""

    title: str = Field(..., min_length=3, max_length=200, description="Title of the notice")
    content: str = Field(..., description="Full content/body of the notice")
    target_role: NoticeTargetRole = "all"
    class_id: int | None = Field(
        None, description="Optional class ID if the notice targets a specific batch"
    )

    @field_validator("title")
    @classmethod
    def trim_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("content")
    @classmethod
    def trim_content(cls, v: str) -> str:
        return v.strip()


class NoticeUpdate(BaseModel):
    """Admin or teacher updates an existing notice."""

    title: str | None = Field(None, min_length=3, max_length=200)
    content: str | None = None
    target_role: NoticeTargetRole | None = None
    class_id: int | None = None

    @field_validator("title")
    @classmethod
    def trim_title_optional(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None

    @field_validator("content")
    @classmethod
    def trim_content_optional(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None


class NoticeOut(BaseModel):
    """Response schema containing notice details."""

    id: int
    author_id: int
    title: str
    content: str
    target_role: NoticeTargetRole
    class_id: int | None
    created_at: datetime.datetime

    author: UserOut
    class_: ClassOut | None = None

    model_config = {"from_attributes": True}
