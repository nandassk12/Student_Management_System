"""
app/api/leave.py
────────────────
Leave requests router:
  POST   /leave                          → student requests leave
  GET    /leave                          → admin/teacher lists all requests with filters
  GET    /leave/me                       → returns requests associated with current user (student/teacher)
  GET    /leave/{id}                     → view specific leave request
  POST   /leave/{id}/review              → teacher/admin approves or rejects request
  DELETE /leave/{id}                     → student deletes pending request, admin deletes any
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin, require_teacher
from app.database import get_db
from app.models.leave import LeaveRequest
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.leave import LeaveCreate, LeaveOut, LeaveReview

router = APIRouter(prefix="/leave", tags=["Leave Requests"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_leave_or_404(leave_id: int, db: AsyncSession) -> LeaveRequest:
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found"
        )
    return req


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=LeaveOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new leave request (student only)",
)
async def create_leave(
    payload: LeaveCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> LeaveOut:
    # Only students can request leaves
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit leave requests"
        )

    # Verify teacher/reviewer exists and is a teacher or admin
    teacher_res = await db.execute(select(User).where(User.id == payload.teacher_id))
    teacher = teacher_res.scalar_one_or_none()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewing teacher not found"
        )
    if teacher.role.name not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target reviewer is not a teacher/admin"
        )

    leave_req = LeaveRequest(
        student_id=current_user.user_id,
        teacher_id=payload.teacher_id,
        reason=payload.reason,
        from_date=payload.from_date,
        to_date=payload.to_date,
        status="pending",
    )
    db.add(leave_req)
    await db.flush()
    await db.refresh(leave_req)
    return LeaveOut.model_validate(leave_req)


@router.get(
    "",
    response_model=list[LeaveOut],
    status_code=status.HTTP_200_OK,
    summary="List all leave requests (admin/teacher only)",
)
async def list_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    student_id: int | None = Query(None),
    teacher_id: int | None = Query(None),
    status_val: Literal["pending", "approved", "rejected"] | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[LeaveOut]:
    query = select(LeaveRequest)
    if student_id is not None:
        query = query.where(LeaveRequest.student_id == student_id)
    if teacher_id is not None:
        query = query.where(LeaveRequest.teacher_id == teacher_id)
    if status_val is not None:
        query = query.where(LeaveRequest.status == status_val)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    leaves = result.scalars().all()
    return [LeaveOut.model_validate(l) for l in leaves]


@router.get(
    "/me",
    response_model=list[LeaveOut],
    status_code=status.HTTP_200_OK,
    summary="Get my leave requests (student: requested, teacher: assigned to review)",
)
async def get_my_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> list[LeaveOut]:
    query = select(LeaveRequest)
    if current_user.role_name == "student":
        query = query.where(LeaveRequest.student_id == current_user.user_id)
    elif current_user.role_name == "teacher":
        query = query.where(LeaveRequest.teacher_id == current_user.user_id)
    else:
        # Admins see everything by default in list_leaves, but let's return all here too
        pass

    result = await db.execute(query)
    leaves = result.scalars().all()
    return [LeaveOut.model_validate(l) for l in leaves]


@router.get(
    "/{leave_id}",
    response_model=LeaveOut,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific leave request",
)
async def get_leave(
    leave_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> LeaveOut:
    req = await _get_leave_or_404(leave_id, db)

    # Guard permissions
    if current_user.role_name == "student" and req.student_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this leave request"
        )
    if current_user.role_name == "teacher" and req.teacher_id != current_user.user_id:
        # Teachers can only view requests assigned to them
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not the reviewer for this request"
        )

    return LeaveOut.model_validate(req)


@router.post(
    "/{leave_id}/review",
    response_model=LeaveOut,
    status_code=status.HTTP_200_OK,
    summary="Approve or reject a leave request (teacher/admin only)",
)
async def review_leave(
    leave_id: int,
    payload: LeaveReview,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> LeaveOut:
    req = await _get_leave_or_404(leave_id, db)

    # Verify authorization
    if current_user.role_name == "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students cannot review leave requests"
        )
    if current_user.role_name == "teacher" and req.teacher_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this request"
        )

    req.status = payload.status
    await db.flush()
    await db.refresh(req)
    return LeaveOut.model_validate(req)


@router.delete(
    "/{leave_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete or withdraw a leave request",
)
async def delete_leave(
    leave_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    req = await _get_leave_or_404(leave_id, db)

    # Guard:
    # - Students can only delete/withdraw their own request, and ONLY if it is still pending.
    # - Admins can delete any request.
    # - Teachers cannot delete requests.
    if current_user.role_name == "student":
        if req.student_id != current_user.user_id:
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
            detail="Only students (for pending requests) or admins can delete leave requests"
        )

    await db.delete(req)
    await db.flush()
    return {"detail": "Leave request successfully deleted/withdrawn"}
