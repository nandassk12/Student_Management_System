"""
app/api/courses.py
───────────────────
Courses router:
  POST   /courses                          → admin only
  GET    /courses?department_id=X          → any authenticated user, filterable
  GET    /courses/{id}                     → any authenticated user
  PUT    /courses/{id}                     → admin only
  DELETE /courses/{id}                     → admin only
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin
from app.database import get_db
from app.models.course import Course
from app.models.department import Department
from app.schemas.auth import TokenData
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from fastapi_cache.decorator import cache

router = APIRouter(prefix="/courses", tags=["Courses"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_course_or_404(course_id: int, db: AsyncSession) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=CourseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a course (admin only)",
)
async def create_course(
    payload: CourseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> CourseOut:
    # Validate department exists
    dept = await db.execute(select(Department).where(Department.id == payload.department_id))
    if dept.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")

    # Check duplicate code
    dup = await db.execute(select(Course).where(Course.code == payload.code))
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course with code '{payload.code}' already exists",
        )

    course = Course(
        name=payload.name,
        code=payload.code,
        department_id=payload.department_id,
        credits=payload.credits,
        semester=payload.semester,
    )
    db.add(course)
    await db.flush()
    await db.refresh(course)
    return CourseOut.model_validate(course)


@router.get(
    "",
    response_model=list[CourseOut],
    status_code=status.HTTP_200_OK,
    summary="List courses (any auth user), optionally filter by department",
)
@cache(expire=7200)
async def list_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
    department_id: int | None = Query(None, description="Filter by department ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[CourseOut]:
    query = select(Course)
    if department_id is not None:
        query = query.where(Course.department_id == department_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    courses = result.scalars().all()
    return [CourseOut.model_validate(c) for c in courses]


@router.get(
    "/{course_id}",
    response_model=CourseOut,
    status_code=status.HTTP_200_OK,
    summary="Get a course by ID (any authenticated user)",
)
async def get_course(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
) -> CourseOut:
    course = await _get_course_or_404(course_id, db)
    return CourseOut.model_validate(course)


@router.put(
    "/{course_id}",
    response_model=CourseOut,
    status_code=status.HTTP_200_OK,
    summary="Update a course (admin only)",
)
async def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> CourseOut:
    course = await _get_course_or_404(course_id, db)

    if payload.name is not None:
        course.name = payload.name
    if payload.code is not None:
        course.code = payload.code.upper()
    if payload.department_id is not None:
        dept = await db.execute(select(Department).where(Department.id == payload.department_id))
        if dept.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")
        course.department_id = payload.department_id
    if payload.credits is not None:
        course.credits = payload.credits
    if payload.semester is not None:
        course.semester = payload.semester

    await db.flush()
    await db.refresh(course)
    return CourseOut.model_validate(course)


@router.delete(
    "/{course_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a course (admin only)",
)
async def delete_course(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    course = await _get_course_or_404(course_id, db)
    await db.delete(course)
    await db.flush()
    return {"detail": f"Course '{course.name}' deleted"}
