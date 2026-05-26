"""
app/api/users.py
─────────────────
Users router (Admin only):
  POST   /users         → create user
  GET    /users         → list users (paginated)
  GET    /users/{id}    → get single user
  PUT    /users/{id}    → update user
  DELETE /users/{id}    → deactivate user (soft delete)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import require_admin
from app.database import get_db
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.auth.auth import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_user_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (admin only)",
)
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    # Validate role exists
    role_result = await db.execute(select(Role).where(Role.id == payload.role_id))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")

    # Check duplicate username / email
    dup = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.email)
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
    )
    db.add(user)
    await db.flush()   # get auto-assigned id before commit
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get(
    "",
    response_model=list[UserOut],
    status_code=status.HTTP_200_OK,
    summary="List all users (admin only, paginated with filters)",
)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
    role_id: int | None = Query(None, description="Filter by role ID"),
    role_name: str | None = Query(None, alias="role", description="Filter by role name"),
    username: str | None = Query(None, description="Filter/search by username (substring, case-insensitive)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Max records to return"),
) -> list[UserOut]:
    query = select(User)
    
    if role_id is not None:
        query = query.where(User.role_id == role_id)
    if role_name is not None:
        query = query.join(Role).where(func.lower(Role.name) == role_name.strip().lower())
    if username is not None:
        query = query.where(User.username.ilike(f"%{username.strip()}%"))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    return [UserOut.model_validate(u) for u in users]



@router.get(
    "/{user_id}",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get a single user by ID (admin only)",
)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    user = await _get_user_or_404(user_id, db)
    return UserOut.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Update a user (admin only)",
)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    user = await _get_user_or_404(user_id, db)

    if payload.username is not None:
        user.username = payload.username
    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.role_id is not None:
        role_result = await db.execute(select(Role).where(Role.id == payload.role_id))
        if role_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")
        user.role_id = payload.role_id
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate a user (admin only — soft delete)",
)
async def deactivate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    user = await _get_user_or_404(user_id, db)
    user.is_active = False
    await db.flush()
    return {"detail": f"User '{user.username}' has been deactivated"}
