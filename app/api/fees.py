"""
app/api/fees.py
───────────────
Fees router:
  POST   /fees                          → admin only, creates a fee obligation
  GET    /fees                          → admin/teacher, lists all fees with filters
  GET    /fees/me                       → student, lists own fees
  GET    /fees/student/{student_id}     → student (own) or admin/teacher (any)
  GET    /fees/{fee_id}                 → any auth, view specific fee (student restricted to own)
  PUT    /fees/{fee_id}                 → admin only, updates fee details
  DELETE /fees/{fee_id}                 → admin only, deletes fee record
  POST   /fees/{fee_id}/pay             → any auth, pays fee (student restricted to own)
"""

import datetime
import io
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from app.auth.auth import get_current_user, require_admin, require_teacher
from app.database import get_db
from app.models.fee import Fee
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.fee import FeeCreate, FeeOut, FeePayment, FeeUpdate

router = APIRouter(prefix="/fees", tags=["Fees"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_fee_or_404(fee_id: int, db: AsyncSession) -> Fee:
    result = await db.execute(select(Fee).where(Fee.id == fee_id))
    fee = result.scalar_one_or_none()
    if fee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee record not found"
        )
    return fee


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=FeeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a fee obligation (admin only)",
)
async def create_fee(
    payload: FeeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> FeeOut:
    # Verify student exists and is indeed a student
    user_res = await db.execute(select(User).where(User.id == payload.student_id))
    student = user_res.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student user not found"
        )
    if student.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is not a student"
        )

    fee = Fee(
        student_id=payload.student_id,
        amount=payload.amount,
        fee_type=payload.fee_type,
        status=payload.status,
        due_date=payload.due_date,
    )
    db.add(fee)
    await db.flush()
    await db.refresh(fee)
    return FeeOut.model_validate(fee)


@router.get(
    "",
    response_model=list[FeeOut],
    status_code=status.HTTP_200_OK,
    summary="List all fees with filters (admin and teacher only)",
)
async def list_fees(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    student_id: int | None = Query(None, description="Filter by student ID"),
    fee_type: Literal["tuition", "hostel", "exam", "library"] | None = Query(None),
    status_val: Literal["paid", "pending", "overdue"] | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[FeeOut]:
    query = select(Fee)
    if student_id is not None:
        query = query.where(Fee.student_id == student_id)
    if fee_type is not None:
        query = query.where(Fee.fee_type == fee_type)
    if status_val is not None:
        query = query.where(Fee.status == status_val)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    fees = result.scalars().all()
    return [FeeOut.model_validate(f) for f in fees]


@router.get(
    "/me",
    response_model=list[FeeOut],
    status_code=status.HTTP_200_OK,
    summary="Get own fee obligations (student only)",
)
async def get_my_fees(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> list[FeeOut]:
    if current_user.role_name != "student":
        # Non-students don't have fee obligations
        return []

    result = await db.execute(
        select(Fee).where(Fee.student_id == current_user.user_id)
    )
    fees = result.scalars().all()
    return [FeeOut.model_validate(f) for f in fees]


@router.get(
    "/student/{student_id}",
    response_model=list[FeeOut],
    status_code=status.HTTP_200_OK,
    summary="Get all fees for a specific student",
)
async def get_student_fees(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> list[FeeOut]:
    # Guard: Students can only view their own fees
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own fee records"
        )

    result = await db.execute(
        select(Fee).where(Fee.student_id == student_id)
    )
    fees = result.scalars().all()
    return [FeeOut.model_validate(f) for f in fees]


@router.get(
    "/{fee_id}",
    response_model=FeeOut,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific fee record",
)
async def get_fee(
    fee_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FeeOut:
    fee = await _get_fee_or_404(fee_id, db)

    # Guard: Students can only view their own fees
    if current_user.role_name == "student" and fee.student_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this fee record"
        )

    return FeeOut.model_validate(fee)


@router.put(
    "/{fee_id}",
    response_model=FeeOut,
    status_code=status.HTTP_200_OK,
    summary="Update fee details (admin only)",
)
async def update_fee(
    fee_id: int,
    payload: FeeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> FeeOut:
    fee = await _get_fee_or_404(fee_id, db)

    if payload.amount is not None:
        fee.amount = payload.amount
    if payload.fee_type is not None:
        fee.fee_type = payload.fee_type
    if payload.status is not None:
        fee.status = payload.status
    if payload.due_date is not None:
        fee.due_date = payload.due_date
    if payload.paid_date is not None:
        fee.paid_date = payload.paid_date

    # If updating status to "paid" and paid_date is not set, set it to today.
    # Conversely, if status changes from paid to pending/overdue, clear paid_date.
    if fee.status == "paid" and fee.paid_date is None:
        fee.paid_date = datetime.date.today()
    elif fee.status != "paid":
        fee.paid_date = None

    await db.flush()
    await db.refresh(fee)
    return FeeOut.model_validate(fee)


@router.delete(
    "/{fee_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a fee record (admin only)",
)
async def delete_fee(
    fee_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    fee = await _get_fee_or_404(fee_id, db)
    await db.delete(fee)
    await db.flush()
    return {"detail": f"Fee record {fee_id} successfully deleted"}


@router.post(
    "/{fee_id}/pay",
    response_model=FeeOut,
    status_code=status.HTTP_200_OK,
    summary="Pay a fee",
)
async def pay_fee(
    fee_id: int,
    payload: FeePayment,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FeeOut:
    fee = await _get_fee_or_404(fee_id, db)

    # Guard: Students can only pay their own fees
    if current_user.role_name == "student" and fee.student_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only pay your own fees"
        )

    if fee.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fee is already paid"
        )

    # Set status to paid and update paid date
    fee.status = "paid"
    fee.paid_date = payload.paid_date or datetime.date.today()

    await db.flush()
    await db.refresh(fee)
    return FeeOut.model_validate(fee)


def generate_receipt_pdf(fee: Fee) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'ReceiptTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1e3a5f"), # Accent color
        alignment=1, # Center
        spaceAfter=20
    )
    
    normal_style = ParagraphStyle(
        'ReceiptNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0f172a") # Primary text
    )
    
    header_style = ParagraphStyle(
        'ReceiptHeader',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#ffffff")
    )
    
    bold_style = ParagraphStyle(
        'ReceiptBold',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a")
    )

    story = []
    
    # Header Title
    story.append(Paragraph("FEE PAYMENT RECEIPT", title_style))
    story.append(Spacer(1, 15))
    
    # Metadata info (Receipt No, Date)
    receipt_no = f"REC-{fee.id:06d}"
    paid_date_str = fee.paid_date.strftime("%Y-%m-%d") if fee.paid_date else datetime.date.today().strftime("%Y-%m-%d")
    
    meta_data = [
        [Paragraph(f"<b>Receipt Number:</b> {receipt_no}", normal_style), 
         Paragraph(f"<b>Payment Date:</b> {paid_date_str}", normal_style)]
    ]
    meta_table = Table(meta_data, colWidths=[3.5*inch, 3*inch])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))
    
    # Student Info
    student_name = fee.student.username.capitalize() if fee.student else "N/A"
    student_email = fee.student.email if fee.student else "N/A"
    
    student_data = [
        [Paragraph("<b>Student Name:</b>", bold_style), Paragraph(student_name, normal_style)],
        [Paragraph("<b>Student Email:</b>", bold_style), Paragraph(student_email, normal_style)]
    ]
    student_table = Table(student_data, colWidths=[1.5*inch, 5*inch])
    student_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(student_table)
    story.append(Spacer(1, 20))
    
    # Payment Details Table
    table_data = [
        [Paragraph("Fee Item Type", header_style), Paragraph("Payment Status", header_style), Paragraph("Paid Amount", header_style)],
        [Paragraph(fee.fee_type.replace('_', ' ').capitalize(), normal_style), Paragraph(fee.status.upper(), normal_style), Paragraph(f"INR {fee.amount:.2f}", normal_style)]
    ]
    
    details_table = Table(table_data, colWidths=[2.5*inch, 2*inch, 2*inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a5f")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    
    story.append(details_table)
    story.append(Spacer(1, 30))
    
    # Footer Note
    footer_style = ParagraphStyle(
        'ReceiptFooter',
        parent=styles['Italic'],
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor("#94a3b8")
    )
    story.append(Paragraph("This is an electronically generated receipt and does not require a physical signature.", footer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


@router.get(
    "/{fee_id}/receipt",
    summary="Download receipt for a paid fee record",
)
async def get_fee_receipt(
    fee_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
):
    fee = await _get_fee_or_404(fee_id, db)

    # Guard: Students can only access their own fees
    if current_user.role_name == "student" and fee.student_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this fee receipt"
        )

    # Ensure only paid fees can generate receipts
    if fee.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt can only be generated for paid fees"
        )

    buffer = generate_receipt_pdf(fee)
    headers = {
        'Content-Disposition': f'attachment; filename="receipt_{fee_id}.pdf"'
    }
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)

