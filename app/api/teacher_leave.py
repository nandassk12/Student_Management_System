"""
app/api/teacher_leave.py
────────────────────────
Teacher leave requests router:
  POST   /teacher/leave                     → teacher requests leave
  GET    /teacher/leave                     → admin lists all requests with filters
  GET    /teacher/leave/me                  → returns requests associated with current user (teacher)
  GET    /teacher/leave/{id}                → view specific leave request
  POST   /teacher/leave/{id}/review         → admin approves or rejects request
  DELETE /teacher/leave/{id}                → teacher deletes pending request, admin deletes any
"""

import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin
from app.database import get_db
from app.models.teacher_leave import TeacherLeaveRequest
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.teacher_leave import TeacherLeaveCreate, TeacherLeaveOut, TeacherLeaveReview

router = APIRouter(prefix="/teacher/leave", tags=["Teacher Leave Requests"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_teacher_leave_or_404(leave_id: int, db: AsyncSession) -> TeacherLeaveRequest:
    result = await db.execute(select(TeacherLeaveRequest).where(TeacherLeaveRequest.id == leave_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher leave request not found"
        )
    return req


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=TeacherLeaveOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new teacher leave request (teacher only)",
)
async def create_teacher_leave(
    payload: TeacherLeaveCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TeacherLeaveOut:
    # Only teachers can request leaves
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can submit leave requests"
        )

    # Verify admin/reviewer exists and is an admin
    admin_res = await db.execute(select(User).where(User.id == payload.admin_id))
    admin = admin_res.scalar_one_or_none()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewing admin not found"
        )
    if admin.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target reviewer is not an admin"
        )

    leave_req = TeacherLeaveRequest(
        teacher_id=current_user.user_id,
        admin_id=payload.admin_id,
        reason=payload.reason,
        from_date=payload.from_date,
        to_date=payload.to_date,
        status="pending",
    )
    db.add(leave_req)
    await db.flush()
    await db.refresh(leave_req)
    return TeacherLeaveOut.model_validate(leave_req)


@router.get(
    "",
    response_model=list[TeacherLeaveOut],
    status_code=status.HTTP_200_OK,
    summary="List all teacher leave requests (admin only)",
)
async def list_teacher_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
    teacher_id: int | None = Query(None),
    admin_id: int | None = Query(None),
    status_val: Literal["pending", "approved", "rejected"] | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[TeacherLeaveOut]:
    query = select(TeacherLeaveRequest)
    if teacher_id is not None:
        query = query.where(TeacherLeaveRequest.teacher_id == teacher_id)
    if admin_id is not None:
        query = query.where(TeacherLeaveRequest.admin_id == admin_id)
    if status_val is not None:
        query = query.where(TeacherLeaveRequest.status == status_val)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    leaves = result.scalars().all()
    return [TeacherLeaveOut.model_validate(l) for l in leaves]


@router.get(
    "/me",
    response_model=list[TeacherLeaveOut],
    status_code=status.HTTP_200_OK,
    summary="Get my leave requests (teacher: requested, admin: assigned to review)",
)
async def get_my_teacher_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> list[TeacherLeaveOut]:
    query = select(TeacherLeaveRequest)
    if current_user.role_name == "teacher":
        query = query.where(TeacherLeaveRequest.teacher_id == current_user.user_id)
    elif current_user.role_name == "admin":
        query = query.where(TeacherLeaveRequest.admin_id == current_user.user_id)
    else:
        # Others see nothing
        return []

    result = await db.execute(query)
    leaves = result.scalars().all()
    return [TeacherLeaveOut.model_validate(l) for l in leaves]


@router.get(
    "/{leave_id}",
    response_model=TeacherLeaveOut,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific teacher leave request",
)
async def get_teacher_leave(
    leave_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TeacherLeaveOut:
    req = await _get_teacher_leave_or_404(leave_id, db)

    # Guard permissions
    if current_user.role_name == "teacher" and req.teacher_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this leave request"
        )
    if current_user.role_name == "admin" and req.admin_id != current_user.user_id:
        # Admins can only view requests assigned to them
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not the reviewer for this request"
        )

    return TeacherLeaveOut.model_validate(req)


@router.post(
    "/{leave_id}/review",
    response_model=TeacherLeaveOut,
    status_code=status.HTTP_200_OK,
    summary="Approve or reject a teacher leave request (admin only)",
)
async def review_teacher_leave(
    leave_id: int,
    payload: TeacherLeaveReview,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TeacherLeaveOut:
    req = await _get_teacher_leave_or_404(leave_id, db)

    # Verify authorization
    if current_user.role_name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can review leave requests"
        )
    if req.admin_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this request"
        )

    req.status = payload.status
    await db.flush()
    await db.refresh(req)
    return TeacherLeaveOut.model_validate(req)


@router.delete(
    "/{leave_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete or withdraw a teacher leave request",
)
async def delete_teacher_leave(
    leave_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    req = await _get_teacher_leave_or_404(leave_id, db)

    # Guard:
    # - Teachers can only delete/withdraw their own request, and ONLY if it is still pending.
    # - Admins can delete any request.
    if current_user.role_name == "teacher":
        if req.teacher_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot delete someone else's leave request"
            )
        if req.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete a request that has already been approved or rejected"
            )
    elif current_user.role_name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers (for pending requests) or admins can delete leave requests"
        )

    await db.delete(req)
    await db.flush()
    return {"detail": "Leave request successfully deleted/withdrawn"}
