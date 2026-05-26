"""
app/api/notice.py
─────────────────
Notice board router:
  POST   /notice                         → admin/teacher creates notice
  GET    /notice                         → list notices (filtered by role visibility rules)
  GET    /notice/{notice_id}             → view specific notice details
  PUT    /notice/{notice_id}             → update notice (admin or author only)
  DELETE /notice/{notice_id}             → delete notice (admin or author only)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_teacher
from app.database import get_db
from app.models.notice import Notice
from app.models.class_ import Class_
from app.models.student_profile import StudentProfile
from app.models.enrollment import Enrollment
from app.schemas.auth import TokenData
from app.schemas.notice import NoticeCreate, NoticeOut, NoticeUpdate
from fastapi_cache.decorator import cache

router = APIRouter(prefix="/notice", tags=["Notice Board"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_notice_or_404(notice_id: int, db: AsyncSession) -> Notice:
    result = await db.execute(select(Notice).where(Notice.id == notice_id))
    notice = result.scalar_one_or_none()
    if notice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice not found"
        )
    return notice


async def _get_student_class_id(student_id: int, db: AsyncSession) -> int | None:
    # Resolve the student's class via profile
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is not None and profile.class_id is not None:
        return profile.class_id

    # Fallback to Enrollment
    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.student_id == student_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if enrollment is not None:
        return enrollment.class_id

    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=NoticeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new notice (teacher and admin only)",
)
async def create_notice(
    payload: NoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> NoticeOut:
    # If class_id is provided, verify it exists
    if payload.class_id is not None:
        class_res = await db.execute(select(Class_).where(Class_.id == payload.class_id))
        if class_res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target class not found"
            )

    notice = Notice(
        author_id=current_user.user_id,
        title=payload.title,
        content=payload.content,
        target_role=payload.target_role,
        class_id=payload.class_id,
    )
    db.add(notice)
    await db.flush()
    await db.refresh(notice)
    return NoticeOut.model_validate(notice)


@router.get(
    "",
    response_model=list[NoticeOut],
    status_code=status.HTTP_200_OK,
    summary="List notices with role-based visibility",
)
@cache(expire=1800)
async def list_notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[NoticeOut]:
    query = select(Notice)

    # Apply role-based visibility guards:
    if current_user.role_name == "student":
        student_class_id = await _get_student_class_id(current_user.user_id, db)
        # Student sees all/student targeted notices that have either no class filter,
        # or match the student's assigned/enrolled class.
        query = query.where(
            and_(
                Notice.target_role.in_(["all", "student"]),
                or_(
                    Notice.class_id.is_(None),
                    Notice.class_id == student_class_id
                )
            )
        )
    elif current_user.role_name == "teacher":
        # Teachers see notices targeted to all or teachers
        query = query.where(Notice.target_role.in_(["all", "teacher"]))
    else:
        # Admins can see all notices
        pass

    # Order newest first
    query = query.order_by(Notice.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    notices = result.scalars().all()
    return [NoticeOut.model_validate(n) for n in notices]


@router.get(
    "/{notice_id}",
    response_model=NoticeOut,
    status_code=status.HTTP_200_OK,
    summary="Get notice details by ID",
)
async def get_notice(
    notice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> NoticeOut:
    notice = await _get_notice_or_404(notice_id, db)

    # Guard visibility
    if current_user.role_name == "student":
        if notice.target_role not in ("all", "student"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this notice"
            )
        if notice.class_id is not None:
            student_class_id = await _get_student_class_id(current_user.user_id, db)
            if notice.class_id != student_class_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This notice is targeted to a different class"
                )
    elif current_user.role_name == "teacher":
        if notice.target_role not in ("all", "teacher"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this notice"
            )

    return NoticeOut.model_validate(notice)


@router.put(
    "/{notice_id}",
    response_model=NoticeOut,
    status_code=status.HTTP_200_OK,
    summary="Update a notice (author or admin only)",
)
async def update_notice(
    notice_id: int,
    payload: NoticeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> NoticeOut:
    notice = await _get_notice_or_404(notice_id, db)

    # Guard: Only admin or the original author can edit
    if current_user.role_name != "admin" and notice.author_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this notice"
        )

    # Validate new class_id if provided
    if payload.class_id is not None:
        class_res = await db.execute(select(Class_).where(Class_.id == payload.class_id))
        if class_res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target class not found"
            )

    if payload.title is not None:
        notice.title = payload.title
    if payload.content is not None:
        notice.content = payload.content
    if payload.target_role is not None:
        notice.target_role = payload.target_role
    # Since class_id is optional and nullable, we allow clearing it if class_id is None?
    # Actually, in Pydantic we can distinguish between unset and None.
    # But since it's simple, we can do:
    if payload.class_id is not None:
        notice.class_id = payload.class_id
    elif "class_id" in payload.model_fields_set:
        # User explicitly passed class_id: null
        notice.class_id = None

    await db.flush()
    await db.refresh(notice)
    return NoticeOut.model_validate(notice)


@router.delete(
    "/{notice_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a notice (author or admin only)",
)
async def delete_notice(
    notice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    notice = await _get_notice_or_404(notice_id, db)

    # Guard: Only admin or original author can delete
    if current_user.role_name != "admin" and notice.author_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this notice"
        )

    await db.delete(notice)
    await db.flush()
    return {"detail": f"Notice '{notice.title}' successfully deleted"}
