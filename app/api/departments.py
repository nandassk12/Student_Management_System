"""
app/api/departments.py
───────────────────────
Departments router:
  POST   /departments       → admin only
  GET    /departments       → public (any authenticated user)
  GET    /departments/{id}  → public
  PUT    /departments/{id}  → admin only
  DELETE /departments/{id}  → admin only
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin
from app.database import get_db
from app.models.department import Department
from app.schemas.auth import TokenData
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from fastapi_cache.decorator import cache

router = APIRouter(prefix="/departments", tags=["Departments"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_dept_or_404(dept_id: int, db: AsyncSession) -> Department:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return dept


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=DepartmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department (admin only)",
)
async def create_department(
    payload: DepartmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> DepartmentOut:
    # Check for duplicate code
    dup = await db.execute(select(Department).where(Department.code == payload.code))
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{payload.code}' already exists",
        )
    dept = Department(name=payload.name, code=payload.code)
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.get(
    "",
    response_model=list[DepartmentOut],
    status_code=status.HTTP_200_OK,
    summary="List all departments (any authenticated user)",
)
@cache(expire=7200)
async def list_departments(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[DepartmentOut]:
    result = await db.execute(select(Department).offset(skip).limit(limit))
    depts = result.scalars().all()
    return [DepartmentOut.model_validate(d) for d in depts]


@router.get(
    "/{dept_id}",
    response_model=DepartmentOut,
    status_code=status.HTTP_200_OK,
    summary="Get a department by ID (any authenticated user)",
)
async def get_department(
    dept_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
) -> DepartmentOut:
    dept = await _get_dept_or_404(dept_id, db)
    return DepartmentOut.model_validate(dept)


@router.put(
    "/{dept_id}",
    response_model=DepartmentOut,
    status_code=status.HTTP_200_OK,
    summary="Update a department (admin only)",
)
async def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> DepartmentOut:
    dept = await _get_dept_or_404(dept_id, db)
    if payload.name is not None:
        dept.name = payload.name
    if payload.code is not None:
        dept.code = payload.code
    await db.flush()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.delete(
    "/{dept_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a department (admin only)",
)
async def delete_department(
    dept_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    dept = await _get_dept_or_404(dept_id, db)
    await db.delete(dept)
    await db.flush()
    return {"detail": f"Department '{dept.name}' deleted"}
