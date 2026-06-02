from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated
from pydantic import BaseModel
from datetime import datetime
import io

from app.database import get_db
from app.auth.auth import require_teacher, require_student
from app.schemas.auth import TokenData
from app.services.report_data import fetch_student_report_data, fetch_class_student_ids
from app.services.report_generator import generate_progress_report

router = APIRouter(prefix="/ai/reports", tags=["AI Reports"])


class GenerateReportRequest(BaseModel):
    student_id: int | None = None
    class_id: int | None = None
    semester: int
    academic_year: str


class ApproveReportRequest(BaseModel):
    edited_narrative: str | None = None


class ReportOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    roll_number: str | None
    department: str | None
    semester: int
    academic_year: str
    narrative: str
    edited_narrative: str | None
    risk_flags: list[dict]
    status: str
    current_cgpa: float | None
    overall_attendance: float | None
    created_at: datetime
    approved_at: datetime | None

    class Config:
        from_attributes = True


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_reports(
    payload: GenerateReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport

    if not payload.student_id and not payload.class_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either student_id or class_id",
        )

    student_ids = []
    if payload.student_id:
        student_ids = [payload.student_id]
    else:
        student_ids = await fetch_class_student_ids(payload.class_id, db)
        if not student_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="no students found in this class",
            )

    created = []

    for sid in student_ids:
        data = await fetch_student_report_data(
            student_id=sid,
            semester=payload.semester,
            academic_year=payload.academic_year,
            db=db,
        )
        result = await generate_progress_report(data)

        report = AiReport(
            student_id=sid,
            teacher_id=current_user.user_id,
            semester=payload.semester,
            academic_year=payload.academic_year,
            narrative=result["narrative"],
            risk_flags=result["risk_flags"],
            status="draft",
            current_cgpa=result["current_cgpa"],
            overall_attendance=result["overall_attendance"],
        )
        db.add(report)
        await db.flush()
        await db.refresh(report)
        created.append({"student_id": sid, "report_id": report.id})

    await db.commit()

    return {
        "created": len(created),
        "reports": created,
        "errors": [],
    }


@router.get("/student/{student_id}", response_model=list[ReportOut])
async def get_student_reports(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport, User, StudentProfile
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(AiReport)
        .where(AiReport.student_id == student_id)
        .options(
            selectinload(AiReport.student)
            .selectinload(User.student_profile)
            .selectinload(StudentProfile.department)
        )
        .order_by(AiReport.created_at.desc())
    )
    return res.scalars().all()


@router.get("/class/{class_id}", response_model=list[ReportOut])
async def get_class_reports(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport, User, StudentProfile
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(AiReport)
        .join(User, AiReport.student_id == User.id)
        .join(StudentProfile, User.id == StudentProfile.user_id)
        .where(StudentProfile.class_id == class_id)
        .options(
            selectinload(AiReport.student)
            .selectinload(User.student_profile)
            .selectinload(StudentProfile.department)
        )
        .order_by(AiReport.created_at.desc())
    )
    return res.scalars().all()


@router.get("/me", response_model=list[ReportOut])
async def get_my_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
):
    from app.models import AiReport, User, StudentProfile
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(AiReport)
        .where(
            AiReport.student_id == current_user.user_id,
            AiReport.status == "approved",
        )
        .options(
            selectinload(AiReport.student)
            .selectinload(User.student_profile)
            .selectinload(StudentProfile.department)
        )
        .order_by(AiReport.created_at.desc())
    )
    return res.scalars().all()


@router.put("/{report_id}/approve", response_model=ReportOut)
async def approve_report(
    report_id: int,
    payload: ApproveReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport, User, StudentProfile
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(AiReport)
        .where(AiReport.id == report_id)
        .options(
            selectinload(AiReport.student)
            .selectinload(User.student_profile)
            .selectinload(StudentProfile.department)
        )
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your report")

    report.status = "approved"
    report.approved_at = datetime.utcnow()
    if payload.edited_narrative:
        report.edited_narrative = payload.edited_narrative

    await db.commit()
    
    # Re-fetch report with relationship options loaded to return full ReportOut
    res = await db.execute(
        select(AiReport)
        .where(AiReport.id == report_id)
        .options(
            selectinload(AiReport.student)
            .selectinload(User.student_profile)
            .selectinload(StudentProfile.department)
        )
    )
    return res.scalar_one_or_none()


class BulkApproveRequest(BaseModel):
    class_id: int
    semester: int
    academic_year: str


@router.post("/bulk-approve", status_code=status.HTTP_200_OK)
async def bulk_approve_reports(
    payload: BulkApproveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport, StudentProfile, User

    # Strictly filter rows by class_id, semester, academic_year, and status == 'draft'
    stmt = (
        select(AiReport)
        .join(User, AiReport.student_id == User.id)
        .join(StudentProfile, User.id == StudentProfile.user_id)
        .where(
            StudentProfile.class_id == payload.class_id,
            AiReport.semester == payload.semester,
            AiReport.academic_year == payload.academic_year,
            AiReport.status == "draft"
        )
    )

    res = await db.execute(stmt)
    drafts = res.scalars().all()

    count = len(drafts)
    for report in drafts:
        report.status = "approved"
        report.approved_at = datetime.utcnow()

    await db.commit()

    return {
        "message": f"Successfully approved {count} draft reports.",
        "approved_count": count
    }


@router.delete("/{report_id}", status_code=status.HTTP_200_OK)
async def delete_report(
    report_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
):
    from app.models import AiReport

    stmt = select(AiReport).where(AiReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this report")

    await db.delete(report)
    await db.commit()

    return {"message": "Report deleted successfully"}


@router.get("/{report_id}/pdf")
async def download_report_pdf(
    report_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
):
    from app.models import AiReport
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    res = await db.execute(select(AiReport).where(AiReport.id == report_id))
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role_name.strip().lower() == "student":
        if report.student_id != current_user.user_id or report.status != "approved":
            raise HTTPException(status_code=403, detail="Access denied")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"],
                                  fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"],
                                fontSize=11, textColor=colors.HexColor("#475569"),
                                spaceAfter=16)
    body_style = ParagraphStyle("body", parent=styles["Normal"],
                                 fontSize=11, leading=18, spaceAfter=12)
    flag_style = ParagraphStyle("flag", parent=styles["Normal"],
                                 fontSize=10, textColor=colors.HexColor("#dc2626"),
                                 spaceAfter=4)

    cell_normal = ParagraphStyle("cell_normal", parent=styles["Normal"], fontSize=9, leading=12)
    cell_header = ParagraphStyle("cell_header", parent=styles["Normal"], fontSize=9, leading=12, fontName="Helvetica-Bold", textColor=colors.white)

    narrative = report.edited_narrative or report.narrative
    story = []

    story.append(Paragraph("Academic Progress Report", title_style))
    story.append(Paragraph(
        f"Semester {report.semester} | {report.academic_year} | "
        f"Generated {report.created_at.strftime('%d %b %Y')}",
        sub_style
    ))

    meta = [
        ["CGPA", str(report.current_cgpa or "N/A")],
        ["Attendance", f"{report.overall_attendance or 'N/A'}%"],
        ["Status", report.status.upper()],
    ]
    t = Table(meta, colWidths=[4*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    # Split the entire narrative by lines
    all_lines = [line.strip() for line in narrative.split("\n")]
    
    current_section = None
    section_lines = []
    
    def flush_section(section, lines):
        if not lines:
            return
        
        # 1. Check if lines contain a table
        table_lines = [l for l in lines if "|" in l]
        if table_lines:
            table_data = []
            for l in table_lines:
                if l.replace("-", "").replace("|", "").strip() == "":
                    continue
                table_data.append([c.strip() for c in l.split("|")])
            if table_data:
                formatted_data = []
                for r_idx, row in enumerate(table_data):
                    if r_idx == 0:
                        formatted_data.append([Paragraph(cell, cell_header) for cell in row])
                    else:
                        formatted_data.append([Paragraph(cell, cell_normal) for cell in row])
                num_cols = len(table_data[0])
                if num_cols == 3:
                    col_widths = [7*cm, 4*cm, 6*cm]
                else:
                    col_widths = [17*cm / num_cols] * num_cols
                t_table = Table(formatted_data, colWidths=col_widths)
                t_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ]))
                story.append(t_table)
                story.append(Spacer(1, 0.4*cm))
            return

        # 2. Explanation Block
        if section == "EXPLANATION":
            alert_items = []
            for l in lines:
                clean = l.lstrip("-").lstrip("•").strip()
                if clean:
                    alert_items.append(f"• {clean}")
            if alert_items:
                alert_text = "<br/>".join(alert_items)
                alert_p = Paragraph(
                    f"<b>Engagement Indicators Alert</b><br/>{alert_text}",
                    ParagraphStyle("alert_style", parent=styles["Normal"], fontSize=9, leading=13, textColor=colors.HexColor("#78350f"))
                )
                alert_table = Table([[alert_p]], colWidths=[17*cm])
                alert_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#fde68a")),
                ]))
                story.append(alert_table)
                story.append(Spacer(1, 0.4*cm))
                
        # 3. AI Overview Block
        elif section == "AI_OVERVIEW":
            situation = ""
            core_risk = ""
            advice = ""
            for l in lines:
                if l.lower().startswith("- situation:") or l.lower().startswith("situation:"):
                    situation = l.split(":", 1)[1].strip()
                elif l.lower().startswith("- core risk:") or l.lower().startswith("core risk:"):
                    core_risk = l.split(":", 1)[1].strip()
                elif l.lower().startswith("- advice:") or l.lower().startswith("advice:"):
                    advice = l.split(":", 1)[1].strip()
            
            story.append(Paragraph("AI OVERVIEW & INSIGHTS", ParagraphStyle("ai_hdr", parent=styles["Heading2"], fontSize=11, leading=14, textColor=colors.HexColor("#1e3a5f"), spaceBefore=10, spaceAfter=6)))
            if situation:
                story.append(Paragraph(f"<b>Current Situation:</b><br/>{situation}", body_style))
                story.append(Spacer(1, 0.2*cm))
            if core_risk:
                risk_p = Paragraph(
                    f"<b>Core Risk & Roadblocks:</b><br/>{core_risk}",
                    ParagraphStyle("risk_p_style", parent=styles["Normal"], fontSize=9, leading=13, textColor=colors.HexColor("#7f1d1d"))
                )
                risk_table = Table([[risk_p]], colWidths=[17*cm])
                risk_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fee2e2")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#fecaca")),
                ]))
                story.append(risk_table)
                story.append(Spacer(1, 0.3*cm))
            if advice:
                advice_p = Paragraph(
                    f"<b>Actionable Advice for Faculty:</b><br/>{advice}",
                    ParagraphStyle("advice_p_style", parent=styles["Normal"], fontSize=9, leading=13, textColor=colors.HexColor("#14532d"))
                )
                advice_table = Table([[advice_p]], colWidths=[17*cm])
                advice_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#bbf7d0")),
                ]))
                story.append(advice_table)
                story.append(Spacer(1, 0.4*cm))
                
        # 4. Remarks Block
        elif section == "REMARKS":
            remarks_text = " ".join([l for l in lines if l.replace("-", "").strip() != ""])
            story.append(Paragraph("TEACHER/ADVISOR REMARKS", ParagraphStyle("rem_hdr", parent=styles["Heading2"], fontSize=11, leading=14, textColor=colors.HexColor("#1e3a5f"), spaceBefore=10, spaceAfter=6)))
            if remarks_text:
                story.append(Paragraph(remarks_text, body_style))
                
        # 5. Generic Block
        else:
            for l in lines:
                if l.replace("-", "").strip() != "":
                    story.append(Paragraph(l, body_style))

    for line in all_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        
        # Check for section transitions
        if "1. ACADEMIC PERFORMANCE" in line_clean:
            flush_section(current_section, section_lines)
            current_section = "ACADEMIC_TABLE"
            section_lines = []
            story.append(Paragraph("1. ACADEMIC PERFORMANCE", ParagraphStyle("sec1", parent=styles["Heading2"], fontSize=12, leading=15, textColor=colors.HexColor("#1e3a5f"), spaceBefore=10, spaceAfter=6)))
        elif "2. COURSE ENGAGEMENT & ATTENDANCE" in line_clean:
            flush_section(current_section, section_lines)
            current_section = "ATTENDANCE_TABLE"
            section_lines = []
            story.append(Paragraph("2. COURSE ENGAGEMENT & ATTENDANCE", ParagraphStyle("sec2", parent=styles["Heading2"], fontSize=12, leading=15, textColor=colors.HexColor("#1e3a5f"), spaceBefore=10, spaceAfter=6)))
        elif "[EXPLANATION" in line_clean:
            flush_section(current_section, section_lines)
            current_section = "EXPLANATION"
            section_lines = []
        elif "AI OVERVIEW" in line_clean:
            flush_section(current_section, section_lines)
            current_section = "AI_OVERVIEW"
            section_lines = []
        elif "REMARKS" in line_clean:
            flush_section(current_section, section_lines)
            current_section = "REMARKS"
            section_lines = []
        else:
            if line_clean.replace("-", "").strip() == "":
                continue
            section_lines.append(line_clean)
            
    # Flush the last section
    flush_section(current_section, section_lines)


    if report.risk_flags:
        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph("Risk Flags", styles["Heading2"]))
        for flag in report.risk_flags:
            story.append(Paragraph(f"⚠ {flag.get('message', '')}", flag_style))

    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"},
    )
