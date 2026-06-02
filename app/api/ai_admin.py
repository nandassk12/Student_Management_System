"""
app/api/ai_admin.py
────────────────────
AI-powered Admin Analytics router.

Exposes three endpoint groups:
  1. GET  /ai/admin/health              — latest cached health report
     POST /ai/admin/health/generate     — regenerate (force LLM call)
     POST /ai/admin/health/chat         — chat Q&A over the health report

  2. GET  /ai/admin/departments/report  — department comparison data + AI commentary
     GET  /ai/admin/departments/report/pdf — PDF export via reportlab

  3. GET  /ai/admin/teachers/activity   — per-teacher compliance with AI flags
"""

from __future__ import annotations

import io
import json
import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.auth.auth import require_admin
from app.schemas.auth import TokenData
from app.services.llm import chat_complete, build_messages
from app.services.admin_data import (
    institutional_health_metrics,
    available_health_semesters,
    dept_comparison_metrics,
    teacher_activity_completeness,
    build_health_prompt,
    build_dept_commentary_prompt,
    build_teacher_flag_prompt,
    build_health_chat_prompt,
)

router = APIRouter(prefix="/ai/admin", tags=["AI Admin Analytics"])


# ─────────────────────────────────────────────────────────────────────────────
# In-memory cache for health report (avoids hitting LLM on every GET)
# Format: {"id": 1, "content": "...", "flags": [...], "generated_at": "...", ...}
# ─────────────────────────────────────────────────────────────────────────────
_health_report_cache: dict | None = None
_health_report_id_seq = 0


def _next_report_id() -> int:
    global _health_report_id_seq
    _health_report_id_seq += 1
    return _health_report_id_seq


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_flags_from_metrics(metrics: dict) -> list[dict]:
    """Derive structured system flags from the raw metrics dict."""
    flags = []
    now_str = datetime.datetime.utcnow().isoformat()

    if metrics["avg_attendance_pct"] < 75:
        flags.append({
            "category": "Attendance Crisis",
            "level": "critical",
            "message": f"Institution-wide average attendance is {metrics['avg_attendance_pct']}% — below the 75% minimum threshold.",
            "timestamp": now_str,
        })

    if metrics["detention_risk_count"] > 0:
        flags.append({
            "category": "Detention Risk",
            "level": "warning" if metrics["detention_risk_count"] < 10 else "critical",
            "message": f"{metrics['detention_risk_count']} students have attendance below 75% and are at detention risk.",
            "timestamp": now_str,
        })

    if metrics["fee_collection_rate"] < 70:
        flags.append({
            "category": "Fee Collection",
            "level": "critical",
            "message": f"Fee collection rate is {metrics['fee_collection_rate']}% — significantly below target.",
            "timestamp": now_str,
        })
    elif metrics["fee_collection_rate"] < 85:
        flags.append({
            "category": "Fee Collection",
            "level": "warning",
            "message": f"Fee collection rate is {metrics['fee_collection_rate']}% — below the 85% benchmark.",
            "timestamp": now_str,
        })

    if metrics["leave_spike"]:
        flags.append({
            "category": "Leave Spike",
            "level": "warning",
            "message": (
                f"Leave requests this week ({metrics['this_week_leaves']}) are "
                f"{round(metrics['this_week_leaves'] / max(metrics['weekly_avg_leaves'], 0.01), 1)}× "
                f"the weekly average ({metrics['weekly_avg_leaves']})."
            ),
            "timestamp": now_str,
        })

    if metrics["pending_leaves_count"] > 10:
        flags.append({
            "category": "Pending Leave Backlog",
            "level": "warning",
            "message": f"{metrics['pending_leaves_count']} student leave requests are awaiting teacher review.",
            "timestamp": now_str,
        })

    if metrics["avg_cgpa"] < 2.5:
        flags.append({
            "category": "Academic Performance",
            "level": "critical",
            "message": f"Institution-wide average CGPA is {metrics['avg_cgpa']} — below the 2.5 academic threshold.",
            "timestamp": now_str,
        })

    return flags


async def _generate_health_report(
    db: AsyncSession,
    semester: int | None = None,
    academic_year: str | None = None,
) -> dict:
    """Run data queries + LLM call and return a fresh health report dict."""
    global _health_report_cache

    metrics = await institutional_health_metrics(db, semester=semester, academic_year=academic_year)
    flags = _build_flags_from_metrics(metrics)

    # Determine current semester/year heuristically from available grades
    from app.models.grade import Grade
    from sqlalchemy import func
    sem_res = await db.execute(
        select(func.max(Grade.semester), Grade.academic_year)
        .group_by(Grade.academic_year)
        .order_by(func.max(Grade.semester).desc())
        .limit(1)
    )
    sem_row = sem_res.one_or_none()
    current_semester = sem_row[0] if sem_row else 1
    current_academic_year = sem_row[1] if sem_row else "2024-2025"

    # LLM call for narrative
    messages = build_health_prompt(metrics)
    try:
        narrative = await chat_complete(messages, temperature=0.4, max_tokens=1024)
    except Exception as exc:
        narrative = (
            f"[AI narrative generation failed: {exc}]\n\n"
            f"Raw metrics summary:\n"
            f"• Students: {metrics['total_students']} | Teachers: {metrics['total_teachers']}\n"
            f"• Avg CGPA: {metrics['avg_cgpa']} | Attendance: {metrics['avg_attendance_pct']}%\n"
            f"• Fee Collection: {metrics['fee_collection_rate']}% | Detention Risk: {metrics['detention_risk_count']} students"
        )

    fee_rate = metrics["fee_collection_rate"]
    spike_threshold = round(metrics["weekly_avg_leaves"] * 1.5, 1)

    report = {
        "id": _next_report_id(),
        "semester": current_semester,
        "academic_year": current_academic_year,
        "generated_at": metrics["generated_at"],
        "generated_by": "ai",
        "content": narrative,

        # ── Structured flags object ──────────────────────────────────────────
        # `alerts` = system-level anomaly cards (what used to be the bare flags list)
        # chart datasets use the exact keys the frontend Recharts components expect
        "flags": {
            # System alert cards (level/category/message)
            "alerts": flags,

            # Chart A — Detention Risk Clusters (horizontal BarChart)
            # dataKey="count", category axis dataKey="department"
            "detention_risk_data": [
                {"department": d["dept_name"], "count": d["risk_count"]}
                for d in metrics.get("dept_detention", [])
            ],

            # Chart B — Academic Drift Matrix (grouped BarChart)
            # dataKey="cgpa" + "attendance", xAxis dataKey="department"
            "academic_drift_data": [
                {
                    "department": d["dept_name"],
                    "cgpa": d["cgpa"],
                    "attendance": d["attendance"],
                }
                for d in metrics.get("dept_academic", [])
            ],

            # Chart C — Fee Collection Progress (static gauge; not a Recharts array)
            "fee_collection": {
                "rate": fee_rate,
                "benchmark": 85.0,
                "gap": round(max(0.0, 85.0 - fee_rate), 1),
            },

            # Chart D — Leave Spike Timeline (AreaChart)
            # dataKey="requests", xAxis dataKey="week"
            "leave_timeline_data": [
                {"week": w["week"], "requests": w["count"]}
                for w in metrics.get("weekly_leaves", [])
            ],

            # Reference lines metadata for Chart D
            "leave_metadata": {
                "weekly_baseline": metrics["weekly_avg_leaves"],
                "spike_threshold": spike_threshold,
                "leave_spike": metrics["leave_spike"],
            },
        },

        # Full raw metrics kept for LLM chat context (not rendered directly)
        "metrics": metrics,
    }
    _health_report_cache = report
    return report


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT GROUP 1: Health Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/health/semesters", summary="List all available semester/year options")
async def get_available_semesters(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> list[dict]:
    """
    Returns all (semester, academic_year) pairs that have grade data.
    Used to populate the dashboard semester/year dropdowns.
    """
    return await available_health_semesters(db)


@router.get("/health", summary="Get institutional health report")
async def get_health_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
    semester: int | None = Query(default=None, description="Filter by semester number"),
    academic_year: str | None = Query(default=None, description="Filter by academic year e.g. 2024-2025"),
) -> dict:
    """
    Returns the cached health report (or generates one on first call).
    When semester/academic_year params are supplied, always generates a fresh
    report scoped to that period (does NOT overwrite the default cache).
    """
    global _health_report_cache
    # Filtered requests → fresh report, not cached
    if semester is not None or academic_year is not None:
        return await _generate_health_report(db, semester=semester, academic_year=academic_year)
    if _health_report_cache is None:
        _health_report_cache = await _generate_health_report(db)
    return _health_report_cache


@router.post(
    "/health/generate",
    summary="Force-regenerate the institutional health report",
    status_code=status.HTTP_200_OK,
)
async def regenerate_health_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    """Re-runs all queries + LLM call and updates the cache."""
    report = await _generate_health_report(db)
    return {"message": "Health report regenerated successfully", "report_id": report["id"]}


@router.post("/health/chat", summary="Chat Q&A over the health report")
async def health_chat(
    payload: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    """Ask a follow-up question over the current health report context."""
    global _health_report_cache
    if _health_report_cache is None:
        _health_report_cache = await _generate_health_report(db)

    report_content = _health_report_cache.get("content", "No report content available.")
    messages = build_health_chat_prompt(report_content, payload.question)
    try:
        answer = await chat_complete(messages, temperature=0.3, max_tokens=512)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM call failed: {exc}",
        )
    return {"answer": answer}


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT GROUP 2: Department Comparison Report
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/departments/report", summary="Department comparison analytics")
async def get_department_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
    semester: int | None = Query(default=None, description="Filter by semester number"),
    academic_year: str | None = Query(default=None, description="Filter by academic year e.g. 2024-2025"),
) -> dict:
    """
    Returns per-department metrics + AI commentary on outliers.
    New shape: {ai_commentary, absolute_trends, variance_deltas, rankings, generated_at}
    """
    dept_data = await dept_comparison_metrics(db, semester=semester, academic_year=academic_year)

    # LLM commentary using variance deltas
    messages = build_dept_commentary_prompt(dept_data)
    try:
        ai_commentary = await chat_complete(messages, temperature=0.5, max_tokens=512)
    except Exception as exc:
        ai_commentary = f"[AI commentary unavailable: {exc}]"

    return {
        "ai_commentary": ai_commentary,
        "absolute_trends": dept_data["absolute_trends"],
        "variance_deltas": dept_data["variance_deltas"],
        "rankings": dept_data["rankings"],
        # Keep legacy fields for PDF route
        "departments": dept_data["raw_depts"],
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }


@router.get("/departments/report/pdf", summary="Export department report as PDF")
async def export_department_report_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
    semester: int | None = Query(default=None),
    academic_year: str | None = Query(default=None),
):
    """
    Generates and streams a PDF department comparison report using ReportLab.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    dept_data = await dept_comparison_metrics(db, semester=semester, academic_year=academic_year)
    dept_rows = dept_data["raw_depts"]
    messages = build_dept_commentary_prompt(dept_data)
    try:
        commentary = await chat_complete(messages, temperature=0.5, max_tokens=512)
    except Exception:
        commentary = "AI commentary unavailable at this time."

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=18, spaceAfter=6)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10,
                               textColor=colors.HexColor("#475569"), spaceAfter=16)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10,
                                leading=16, spaceAfter=12)
    section_style = ParagraphStyle("section", parent=styles["Heading2"], fontSize=13,
                                   spaceBefore=16, spaceAfter=8)

    story = []
    story.append(Paragraph("Department Comparison Report", title_style))
    story.append(Paragraph(
        f"Generated: {datetime.datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}",
        sub_style
    ))

    # AI Commentary section
    story.append(Paragraph("AI Executive Commentary", section_style))
    for para in commentary.split("\n\n"):
        if para.strip():
            story.append(Paragraph(para.strip().replace("\n", " "), body_style))
    story.append(Spacer(1, 0.5 * cm))

    # ── Four ranked tables ────────────────────────────────────────────────────
    metrics_cfg = [
        ("CGPA Average Ranking", "cgpa", False, lambda v: f"{v:.2f}"),
        ("Attendance Rate Ranking", "attendance", False, lambda v: f"{v:.1f}%"),
        ("Fee Collection Rate Ranking", "fee_rate", False, lambda v: f"{v:.1f}%"),
        ("Detention Risk Count", "detention_risk", True, lambda v: str(v)),
    ]

    header_bg = colors.HexColor("#1e3a5f")
    alt_bg = colors.HexColor("#f8fafc")
    grid_color = colors.HexColor("#e2e8f0")

    for table_title, metric_key, ascending, fmt_fn in metrics_cfg:
        story.append(Paragraph(table_title, section_style))
        ranked = sorted(dept_rows, key=lambda d: d[metric_key], reverse=not ascending)

        table_data = [["Rank", "Department", "Value"]]
        for i, dept in enumerate(ranked, 1):
            table_data.append([str(i), dept["dept_name"], fmt_fn(dept[metric_key])])

        col_widths = [1.5 * cm, 9 * cm, 4 * cm]
        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, grid_color),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, alt_bg]),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))

    doc.build(story)
    buffer.seek(0)
    filename = f"dept_report_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT GROUP 3: Teacher Activity Monitor
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/teachers/activity", summary="Per-teacher compliance activity with AI flags")
async def get_teacher_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> list[dict]:
    """
    Returns a list of teacher activity completeness records, each with:
    - teacher_id, teacher_name
    - activities: {grades_entered, materials_uploaded, leave_reviewed, notices_posted, timetable_covered}
      Each value is 'ok' | 'warning' | 'critical'
    - overall_status: 'ok' | 'warning' | 'critical'
    - ai_flags: [{level, message}] — AI-generated recommendations for non-compliant teachers
    """
    teachers = await teacher_activity_completeness(db)

    result = []
    for teacher in teachers:
        ai_flags = []
        if teacher["overall_status"] != "ok":
            messages = build_teacher_flag_prompt(teacher)
            if messages:  # only if there are issues
                try:
                    raw_response = await chat_complete(messages, temperature=0.3, max_tokens=512)
                    # Parse JSON array from LLM response
                    # Find JSON array bounds robustly
                    start = raw_response.find("[")
                    end = raw_response.rfind("]") + 1
                    if start != -1 and end > start:
                        ai_flags = json.loads(raw_response[start:end])
                    else:
                        # Fallback: generate flags from activities directly
                        ai_flags = _generate_fallback_flags(teacher)
                except Exception:
                    ai_flags = _generate_fallback_flags(teacher)

        # Build public-facing record (strip internal _details)
        result.append({
            "teacher_id": teacher["teacher_id"],
            "teacher_name": teacher["teacher_name"],
            "activities": teacher["activities"],
            "overall_status": teacher["overall_status"],
            "ai_flags": ai_flags,
        })

    return result


def _generate_fallback_flags(teacher: dict) -> list[dict]:
    """Generate deterministic flags when LLM call fails."""
    acts = teacher["activities"]
    d = teacher["_details"]
    flags = []

    if acts["grades_entered"] != "ok":
        courses_str = ", ".join(d["missing_grade_courses"]) or "assigned courses"
        flags.append({
            "level": acts["grades_entered"],
            "message": f"Grades not submitted for: {courses_str}. Please enter all student grades to ensure accurate GPA calculations.",
        })
    if acts["materials_uploaded"] != "ok":
        courses_str = ", ".join(d["missing_material_courses"]) or "assigned courses"
        flags.append({
            "level": acts["materials_uploaded"],
            "message": f"No study materials uploaded for: {courses_str}. Students require resource access for effective learning.",
        })
    if acts["leave_reviewed"] != "ok":
        flags.append({
            "level": acts["leave_reviewed"],
            "message": f"{d['stale_leaves_count']} leave request(s) pending over 7 days. Please review and take action promptly.",
        })
    if acts["notices_posted"] != "ok":
        flags.append({
            "level": "warning",
            "message": "No notices posted this term. Regular communication through the notice board keeps students informed.",
        })
    if acts["timetable_covered"] != "ok":
        courses_str = ", ".join(d["unmarked_att_courses"]) or "some courses"
        flags.append({
            "level": acts["timetable_covered"],
            "message": f"Attendance not marked for scheduled sessions in: {courses_str}. This affects student records.",
        })

    return flags
