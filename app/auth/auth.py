"""
app/auth/auth.py
─────────────────
JWT token creation/verification, password hashing via bcrypt,
and FastAPI dependency functions for role-based access control.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.auth import TokenData

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(data: dict) -> str:
    """
    Create a signed JWT access token.
    Payload must include: user_id, username, role_name.
    """
    payload = data.copy()
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenData:
    """
    Decode and validate a JWT token.
    Raises HTTP 401 on any failure.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int | None = payload.get("user_id")
        username: str | None = payload.get("username")
        role_name: str | None = payload.get("role_name")
        if user_id is None or username is None or role_name is None:
            raise credentials_exc
        return TokenData(user_id=user_id, username=username, role_name=role_name.strip().lower())
    except JWTError:
        raise credentials_exc


# ── Core dependency ───────────────────────────────────────────────────────────

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenData:
    """
    Validate JWT and return decoded TokenData.
    Any authenticated role passes.
    """
    token_data = decode_token(token)

    # Verify the user still exists and is active
    from sqlalchemy import select
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_data


# ── Role-based dependencies ───────────────────────────────────────────────────

async def require_admin(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenData:
    """Only admin role passes."""
    if current_user.role_name.strip().lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_teacher(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenData:
    """Teacher and admin pass."""
    if current_user.role_name.strip().lower() not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required",
        )
    return current_user


async def require_student(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenData:
    """Student, teacher, and admin all pass."""
    if current_user.role_name.strip().lower() not in ("student", "teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication required",
        )
    return current_user
