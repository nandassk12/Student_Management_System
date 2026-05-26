"""
app/api/classes.py
───────────────────
Classes router:
  POST   /classes                         → admin only
  GET    /classes?department_id=X         → any authenticated user, filterable
  GET    /classes/{id}                    → any authenticated user
  PUT    /classes/{id}                    → admin only
  DELETE /classes/{id}                    → admin only
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin
from app.database import get_db
from app.models.class_ import Class_
from app.models.department import Department
from app.schemas.auth import TokenData
from app.schemas.class_ import ClassCreate, ClassOut, ClassUpdate

router = APIRouter(prefix="/classes", tags=["Classes"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_class_or_404(class_id: int, db: AsyncSession) -> Class_:
    result = await db.execute(select(Class_).where(Class_.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return cls


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ClassOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a class (admin only)",
)
async def create_class(
    payload: ClassCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> ClassOut:
    dept = await db.execute(select(Department).where(Department.id == payload.department_id))
    if dept.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")

    cls = Class_(
        name=payload.name,
        department_id=payload.department_id,
        year=payload.year,
        semester=payload.semester,
    )
    db.add(cls)
    await db.flush()
    await db.refresh(cls)
    return ClassOut.model_validate(cls)


@router.get(
    "",
    response_model=list[ClassOut],
    status_code=status.HTTP_200_OK,
    summary="List classes (any auth user), optionally filter by department",
)
async def list_classes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
    department_id: int | None = Query(None, description="Filter by department ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[ClassOut]:
    query = select(Class_)
    if department_id is not None:
        query = query.where(Class_.department_id == department_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    classes = result.scalars().all()
    return [ClassOut.model_validate(c) for c in classes]


@router.get(
    "/{class_id}",
    response_model=ClassOut,
    status_code=status.HTTP_200_OK,
    summary="Get a class by ID (any authenticated user)",
)
async def get_class(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
) -> ClassOut:
    cls = await _get_class_or_404(class_id, db)
    return ClassOut.model_validate(cls)


@router.put(
    "/{class_id}",
    response_model=ClassOut,
    status_code=status.HTTP_200_OK,
    summary="Update a class (admin only)",
)
async def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> ClassOut:
    cls = await _get_class_or_404(class_id, db)

    if payload.name is not None:
        cls.name = payload.name
    if payload.department_id is not None:
        dept = await db.execute(select(Department).where(Department.id == payload.department_id))
        if dept.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")
        cls.department_id = payload.department_id
    if payload.year is not None:
        cls.year = payload.year
    if payload.semester is not None:
        cls.semester = payload.semester

    await db.flush()
    await db.refresh(cls)
    return ClassOut.model_validate(cls)


@router.delete(
    "/{class_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a class (admin only)",
)
async def delete_class(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    cls = await _get_class_or_404(class_id, db)
    await db.delete(cls)
    await db.flush()
    return {"detail": f"Class '{cls.name}' deleted"}
