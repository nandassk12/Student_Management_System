"""
app/schemas/material.py
────────────────────────
Pydantic v2 schemas for Study Material endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserOut
from app.schemas.course import CourseOut

# Valid file types matching database constraints
MaterialType = Literal["pdf", "video", "doc", "link"]


class MaterialCreate(BaseModel):
    """Schema for validating study material metadata on creation/upload."""

    course_id: int
    title: str = Field(..., min_length=3, max_length=200, description="Title of the study material")
    description: str | None = Field(None, description="Optional description of the material")
    file_path: str = Field(..., description="Disk storage path or external URL link")
    file_type: MaterialType
    file_size: int | None = Field(None, description="Size in bytes, nullable for links")

    @field_validator("title")
    @classmethod
    def trim_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("file_path")
    @classmethod
    def trim_file_path(cls, v: str) -> str:
        return v.strip()


class MaterialOut(BaseModel):
    """Response schema containing full study material details."""

    id: int
    teacher_id: int
    course_id: int
    title: str
    description: str | None
    file_path: str
    file_type: MaterialType
    file_size: int | None
    created_at: datetime.datetime

    teacher: UserOut
    course: CourseOut

    model_config = {"from_attributes": True}
