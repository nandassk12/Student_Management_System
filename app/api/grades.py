"""
app/api/grades.py
──────────────────
Grades router:
  POST /grades                      → teacher inputs grade
  PUT  /grades/{id}                 → teacher updates grade
  GET  /grades/me                   → student views own grades
  GET  /grades/class/{class_id}     → teacher views all grades for a class
  GET  /grades/gpa/{student_id}     → GPA calculation (4.0 scale)
"""

from collections import defaultdict
from typing import Annotated
import io

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from app.auth.auth import get_current_user, require_student, require_teacher
from app.database import get_db
from app.models.class_ import Class_
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.user import User
from app.models.attendance import Attendance
from app.schemas.auth import TokenData
from app.schemas.grade import (
    GRADE_GPA_MAP,
    GradeCreate,
    GradeOut,
    GradeUpdate,
    GPAResponse,
    GradeWhatIfRequest,
    GradeWhatIfResponse,
    CourseResult,
    ResultCalculationOut,
    SgpaCourseOut,
    SgpaResponse,
    SemesterCgpaDetail,
    CgpaResponse,
    CgpaPredictionItem,
    SemesterBreakdownItem,
    CgpaPredictionResponse,
)

router = APIRouter(prefix="/grades", tags=["Grades"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_grade_or_404(grade_id: int, db: AsyncSession) -> Grade:
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
    return grade


async def _get_student_or_404(student_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == student_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if user.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified user is not a student",
        )
    return user


async def _get_course_or_404(course_id: int, db: AsyncSession) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=GradeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Teacher inputs a grade for a student",
)
async def create_grade(
    payload: GradeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
) -> GradeOut:
    # Validate student and course exist
    await _get_student_or_404(payload.student_id, db)
    await _get_course_or_404(payload.course_id, db)

    # Prevent duplicate grade for same student + course + semester + academic_year
    dup = await db.execute(
        select(Grade).where(
            Grade.student_id == payload.student_id,
            Grade.course_id == payload.course_id,
            Grade.semester == payload.semester,
            Grade.academic_year == payload.academic_year,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Grade already exists for student {payload.student_id} "
                f"in course {payload.course_id} "
                f"for semester {payload.semester} ({payload.academic_year})"
            ),
        )

    grade = Grade(
        student_id=payload.student_id,
        course_id=payload.course_id,
        marks=payload.marks,
        grade=payload.grade,
        semester=payload.semester,
        academic_year=payload.academic_year,
    )
    db.add(grade)
    await db.flush()
    await db.refresh(grade)
    return GradeOut.model_validate(grade)


@router.put(
    "/{grade_id}",
    response_model=GradeOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher updates an existing grade",
)
async def update_grade(
    grade_id: int,
    payload: GradeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
) -> GradeOut:
    grade = await _get_grade_or_404(grade_id, db)

    if payload.marks is not None:
        grade.marks = payload.marks
    if payload.grade is not None:
        grade.grade = payload.grade
    if payload.semester is not None:
        grade.semester = payload.semester
    if payload.academic_year is not None:
        grade.academic_year = payload.academic_year

    await db.flush()
    await db.refresh(grade)
    return GradeOut.model_validate(grade)


@router.get(
    "",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="List all grades (admin and teacher only)",
)
async def list_all_grades(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    student_id: int | None = Query(None, description="Filter by student ID"),
    course_id: int | None = Query(None, description="Filter by course ID"),
    semester: int | None = Query(None, description="Filter by semester"),
    academic_year: str | None = Query(None, description="Filter by academic year"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[GradeOut]:
    query = select(Grade)
    if student_id is not None:
        query = query.where(Grade.student_id == student_id)
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)

    query = query.order_by(Grade.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]


@router.get(
    "/me",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="Student views their own grades",
)
async def get_my_grades(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    semester: int | None = Query(None, description="Filter by semester"),
    course_id: int | None = Query(None, description="Filter by course ID"),
    academic_year: str | None = Query(None, description="Filter by academic year e.g. 2023-2024"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[GradeOut]:
    query = select(Grade).where(Grade.student_id == current_user.user_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]



@router.get(
    "/class/{class_id}",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher views all grades for students enrolled in a class",
)
async def get_class_grades(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    course_id: int | None = Query(None, description="Filter by course ID"),
    semester: int | None = Query(None, description="Filter by semester"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[GradeOut]:
    # Validate class exists
    cls_result = await db.execute(select(Class_).where(Class_.id == class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # Get student IDs enrolled in this class
    enrollment_result = await db.execute(
        select(Enrollment.student_id).where(Enrollment.class_id == class_id)
    )
    student_ids = [row[0] for row in enrollment_result.all()]

    if not student_ids:
        return []

    query = select(Grade).where(Grade.student_id.in_(student_ids))
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    query = query.order_by(Grade.student_id, Grade.course_id).offset(skip).limit(limit)

    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]


@router.get(
    "/gpa/{student_id}",
    response_model=GPAResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate GPA (4.0 scale) for a student",
)
async def get_gpa(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
    academic_year: str | None = Query(None, description="Filter by academic year"),
) -> GPAResponse:
    # Students can only view their own GPA
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own GPA",
        )

    student = await _get_student_or_404(student_id, db)

    query = select(Grade).where(Grade.student_id == student_id)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)

    result = await db.execute(query)
    grades = result.scalars().all()

    if not grades:
        return GPAResponse(
            student_id=student_id,
            student_username=student.username,
            total_courses=0,
            gpa=0.0,
            grade_breakdown={g: 0 for g in GRADE_GPA_MAP},
        )

    # Count grade distribution
    breakdown: dict[str, int] = defaultdict(int)
    total_points = 0.0

    for g in grades:
        letter = g.grade
        breakdown[letter] += 1
        total_points += GRADE_GPA_MAP.get(letter, 0.0)

    gpa = round(total_points / len(grades), 2)

    # Ensure all grades appear in breakdown (even if count is 0)
    full_breakdown = {letter: breakdown.get(letter, 0) for letter in GRADE_GPA_MAP}

    return GPAResponse(
        student_id=student_id,
        student_username=student.username,
        total_courses=len(grades),
        gpa=gpa,
        grade_breakdown=full_breakdown,
    )


def _marks_to_gpa_points(marks: float) -> float:
    """Converts marks out of 100 to standard 4.0 scale GPA points."""
    if marks >= 90.0:
        return 4.0
    elif marks >= 80.0:
        return 3.0
    elif marks >= 70.0:
        return 2.0
    elif marks >= 60.0:
        return 1.0
    else:
        return 0.0


@router.post(
    "/whatif/{student_id}",
    response_model=GradeWhatIfResponse,
    status_code=status.HTTP_200_OK,
    summary="GPA What-If Simulator (recalculate GPA with hypothetical grade)",
)
async def gpa_what_if(
    student_id: int,
    payload: GradeWhatIfRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
) -> GradeWhatIfResponse:
    # Guard: Students can only run simulator for themselves
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only simulate GPA for themselves",
        )

    await _get_student_or_404(student_id, db)
    await _get_course_or_404(payload.course_id, db)

    # 1. Fetch current grades
    result = await db.execute(select(Grade).where(Grade.student_id == student_id))
    grades = result.scalars().all()

    # 2. Calculate current GPA
    if not grades:
        current_gpa = 0.0
    else:
        current_gpa = round(sum(GRADE_GPA_MAP.get(g.grade, 0.0) for g in grades) / len(grades), 2)

    # 3. Simulate replacement/addition
    simulated_points: list[float] = []
    replaced = False
    expected_points = _marks_to_gpa_points(payload.expected_marks)

    for g in grades:
        if g.course_id == payload.course_id:
            # Replace existing course grade points
            simulated_points.append(expected_points)
            replaced = True
        else:
            simulated_points.append(GRADE_GPA_MAP.get(g.grade, 0.0))

    if not replaced:
        # Add new course grade points
        simulated_points.append(expected_points)

    # 4. Calculate predicted GPA
    predicted_gpa = round(sum(simulated_points) / len(simulated_points), 2) if simulated_points else 0.0
    difference = round(predicted_gpa - current_gpa, 2)

    if difference > 0.0:
        impact = "positive"
    elif difference < 0.0:
        impact = "negative"
    else:
        impact = "neutral"

    return GradeWhatIfResponse(
        current_gpa=current_gpa,
        predicted_gpa=predicted_gpa,
        difference=difference,
        impact=impact,
    )


@router.get(
    "/result/{student_id}",
    response_model=ResultCalculationOut,
    status_code=status.HTTP_200_OK,
    summary="Get pass/fail result calculation for a student per course and semester",
)
async def get_result_calculation(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    semester: int = Query(..., description="Semester number (1-8)"),
    academic_year: str = Query(..., description="Academic year (e.g. 2023-2024)"),
) -> ResultCalculationOut:
    # Authorization guard: students can only query their own result
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own grades result",
        )

    await _get_student_or_404(student_id, db)

    # Fetch grades for this student, semester, academic_year
    stmt = select(Grade).where(
        Grade.student_id == student_id,
        Grade.semester == semester,
        Grade.academic_year == academic_year,
    )
    res = await db.execute(stmt)
    grades = res.scalars().all()

    if not grades:
        return ResultCalculationOut(
            courses=[],
            overall_result="PASS",
            semester_gpa=0.0
        )

    course_results = []
    total_marks = 0.0
    any_fail = False

    for g in grades:
        marks = g.marks
        total_marks += marks
        
        if marks >= 75.0:
            res_str = "distinction"
        elif marks >= 50.0:
            res_str = "pass"
        else:
            res_str = "fail"
            any_fail = True

        course_results.append(
            CourseResult(
                course=g.course.name if g.course else "Unknown",
                marks=marks,
                grade=g.grade,
                result=res_str
            )
        )

    avg_marks = total_marks / len(grades)
    
    if any_fail:
        overall_result = "FAIL"
    elif avg_marks >= 75.0:
        overall_result = "DISTINCTION"
    else:
        overall_result = "PASS"

    semester_gpa = round(sum(GRADE_GPA_MAP.get(g.grade, 0.0) for g in grades) / len(grades), 2)

    return ResultCalculationOut(
        courses=course_results,
        overall_result=overall_result,
        semester_gpa=semester_gpa
    )


def generate_report_card_pdf(
    student: User,
    grades: list[Grade],
    attendance_pct: float,
    semester: int,
    academic_year: str,
    sgpa: float,
    overall_result: str,
) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e3a5f"),
        alignment=1, # Center
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e3a5f"),
        spaceBefore=10,
        spaceAfter=6,
        borderPadding=2
    )
    
    normal_style = ParagraphStyle(
        'NormalText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )
    
    bold_style = ParagraphStyle(
        'BoldText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b")
    )
    
    header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#ffffff")
    )
    
    story = []
    
    # Header Title
    story.append(Paragraph("SMS ACADEMIC REPORT CARD", title_style))
    story.append(Spacer(1, 10))
    
    # Student metadata section
    student_name = student.username.capitalize()
    roll_number = student.student_profile.roll_number if student.student_profile else "N/A"
    dept_name = student.student_profile.department.name if (student.student_profile and student.student_profile.department) else "N/A"
    class_name = student.student_profile.class_.name if (student.student_profile and student.student_profile.class_) else "N/A"
    
    info_data = [
        [Paragraph("<b>Student Name:</b>", bold_style), Paragraph(student_name, normal_style),
         Paragraph("<b>Semester:</b>", bold_style), Paragraph(f"Semester {semester}", normal_style)],
        [Paragraph("<b>Roll Number:</b>", bold_style), Paragraph(roll_number, normal_style),
         Paragraph("<b>Academic Year:</b>", bold_style), Paragraph(academic_year, normal_style)],
        [Paragraph("<b>Department:</b>", bold_style), Paragraph(dept_name, normal_style),
         Paragraph("<b>Class Name:</b>", bold_style), Paragraph(class_name, normal_style)]
    ]
    
    info_table = Table(info_data, colWidths=[1.25*inch, 2.25*inch, 1.25*inch, 2.25*inch])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    
    story.append(info_table)
    story.append(Spacer(1, 15))
    story.append(Paragraph("ACADEMIC PERFORMANCE SUMMARY", section_heading))
    
    # Grades table headers
    table_data = [
        [
            Paragraph("Course Code", header_style),
            Paragraph("Course / Subject Name", header_style),
            Paragraph("Credits", header_style),
            Paragraph("Marks", header_style),
            Paragraph("Grade", header_style),
            Paragraph("Status", header_style)
        ]
    ]
    
    for g in grades:
        course_code = g.course.code if g.course else "N/A"
        course_name = g.course.name if g.course else "Unknown"
        course_credits = str(g.course.credits) if g.course else "0"
        status_str = "PASS" if g.marks >= 50.0 else "FAIL"
        
        table_data.append([
            Paragraph(course_code, normal_style),
            Paragraph(course_name, normal_style),
            Paragraph(course_credits, normal_style),
            Paragraph(f"{g.marks:.2f}", normal_style),
            Paragraph(g.grade, normal_style),
            Paragraph(status_str, normal_style)
        ])
        
    grades_table = Table(table_data, colWidths=[1.1*inch, 2.4*inch, 0.7*inch, 0.9*inch, 0.9*inch, 1.0*inch])
    grades_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a5f")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(grades_table)
    story.append(Spacer(1, 15))
    
    # Semester metrics summary block
    result_color = "#16a34a" if overall_result == "PASS" else "#dc2626"
    summary_data = [
        [
            Paragraph("<b>Semester GPA (SGPA):</b>", bold_style),
            Paragraph(f"{sgpa:.2f} / 4.0", normal_style)
        ],
        [
            Paragraph("<b>Attendance Percentage:</b>", bold_style),
            Paragraph(f"{attendance_pct:.2f}%", normal_style)
        ],
        [
            Paragraph("<b>Semester Result Status:</b>", bold_style),
            Paragraph(f"<font color='{result_color}'><b>{overall_result}</b></font>", normal_style)
        ]
    ]
    
    summary_table = Table(summary_data, colWidths=[2.2*inch, 4.8*inch])
    summary_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 30))
    
    # Footer
    footer_style = ParagraphStyle(
        'DocFooter',
        parent=styles['Italic'],
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor("#64748b")
    )
    story.append(Paragraph("This grade report card is electronically generated and verified by the administration. Physical signatures are not required.", footer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


@router.get(
    "/report/{student_id}",
    summary="Download grade report card PDF (student: own, teacher/admin: any)",
)
async def get_grade_report_card(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    semester: int = Query(..., description="Semester number (1-8)"),
    academic_year: str = Query(..., description="Academic year (e.g. 2023-2024)"),
):
    # Guard: students can only query their own report card
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only download their own report card",
        )
        
    # Get student User
    student_stmt = select(User).where(User.id == student_id)
    student_res = await db.execute(student_stmt)
    student = student_res.scalar_one_or_none()
    
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
        
    if student.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified user is not a student",
        )
        
    # Fetch grades
    grades_stmt = select(Grade).where(
        Grade.student_id == student_id,
        Grade.semester == semester,
        Grade.academic_year == academic_year,
    )
    grades_res = await db.execute(grades_stmt)
    grades = grades_res.scalars().all()
    
    if not grades:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No grades recorded for student {student_id} in semester {semester} ({academic_year})",
        )
        
    # Compute SGPA
    sgpa = round(sum(GRADE_GPA_MAP.get(g.grade, 0.0) for g in grades) / len(grades), 2)
    
    # Compute overall result (PASS if all marks >= 50, else FAIL)
    any_fail = any(g.marks < 50.0 for g in grades)
    overall_result = "FAIL" if any_fail else "PASS"
    
    # Compute attendance percentage
    class_id = student.student_profile.class_id if student.student_profile else None
    
    attendance_pct = 100.0
    if class_id is not None:
        attendance_stmt = select(Attendance).join(Class_).where(
            Attendance.student_id == student_id,
            Class_.semester == semester
        )
        attendance_res = await db.execute(attendance_stmt)
        attendance_records = attendance_res.scalars().all()
        
        if attendance_records:
            present_classes = sum(1 for r in attendance_records if r.status in ("present", "late"))
            attendance_pct = round((present_classes / len(attendance_records)) * 100, 2)
            
    # Generate PDF
    buffer = generate_report_card_pdf(
        student=student,
        grades=grades,
        attendance_pct=attendance_pct,
        semester=semester,
        academic_year=academic_year,
        sgpa=sgpa,
        overall_result=overall_result
    )
    
    filename = f"report_card_semester_{semester}_{academic_year.replace('-', '_')}.pdf"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)


def _get_10_point_gpa(marks: float) -> int:
    if marks >= 90.0:
        return 10
    elif marks >= 80.0:
        return 9
    elif marks >= 70.0:
        return 8
    elif marks >= 60.0:
        return 7
    elif marks >= 50.0:
        return 6
    elif marks >= 40.0:
        return 5
    else:
        return 0


def _get_10_point_letter(marks: float) -> str:
    if marks >= 90.0:
        return "O"
    elif marks >= 80.0:
        return "A+"
    elif marks >= 70.0:
        return "A"
    elif marks >= 60.0:
        return "B+"
    elif marks >= 50.0:
        return "B"
    elif marks >= 40.0:
        return "C"
    else:
        return "F"


@router.get(
    "/sgpa/{student_id}",
    response_model=SgpaResponse,
    status_code=status.HTTP_200_OK,
    summary="Get SGPA on a 10-point scale for a student in a semester",
)
async def get_sgpa(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    semester: int = Query(..., description="Semester number (1-8)"),
    academic_year: str = Query(..., description="Academic year (e.g. 2023-2024)"),
) -> SgpaResponse:
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own SGPA",
        )
        
    await _get_student_or_404(student_id, db)
    
    # Fetch grades
    stmt = select(Grade).where(
        Grade.student_id == student_id,
        Grade.semester == semester,
        Grade.academic_year == academic_year,
    )
    res = await db.execute(stmt)
    grades = res.scalars().all()
    
    if not grades:
        return SgpaResponse(semester=semester, sgpa=0.0, total_credits=0, courses=[])
        
    total_weighted_points = 0.0
    total_credits = 0
    courses_out = []
    
    for g in grades:
        credits = g.course.credits if g.course else 3
        points = _get_10_point_gpa(g.marks)
        total_weighted_points += points * credits
        total_credits += credits
        courses_out.append(
            SgpaCourseOut(
                course_id=g.course_id,
                course_name=g.course.name if g.course else "Unknown",
                credits=credits,
                marks=g.marks,
                grade=_get_10_point_letter(g.marks),
                points=points
            )
        )
        
    sgpa = round(total_weighted_points / total_credits, 2) if total_credits > 0 else 0.0
    
    return SgpaResponse(
        semester=semester,
        sgpa=sgpa,
        total_credits=total_credits,
        courses=courses_out
    )


@router.get(
    "/cgpa/{student_id}",
    response_model=CgpaResponse,
    status_code=status.HTTP_200_OK,
    summary="Get cumulative CGPA on a 10-point scale for a student",
)
async def get_cgpa(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> CgpaResponse:
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own CGPA",
        )
        
    await _get_student_or_404(student_id, db)
    
    # Fetch all grades
    stmt = select(Grade).where(Grade.student_id == student_id)
    res = await db.execute(stmt)
    grades = res.scalars().all()
    
    if not grades:
        return CgpaResponse(cgpa=0.0, total_credits=0, semesters=[])
        
    # Group by semester
    sem_groups = defaultdict(list)
    for g in grades:
        sem_groups[g.semester].append(g)
        
    semester_details = []
    total_weighted_sgpa = 0.0
    total_credits = 0
    
    for sem, s_grades in sem_groups.items():
        sem_weighted = 0.0
        sem_credits = 0
        for g in s_grades:
            credits = g.course.credits if g.course else 3
            points = _get_10_point_gpa(g.marks)
            sem_weighted += points * credits
            sem_credits += credits
            
        sem_sgpa = round(sem_weighted / sem_credits, 2) if sem_credits > 0 else 0.0
        semester_details.append(
            SemesterCgpaDetail(
                semester=sem,
                sgpa=sem_sgpa,
                credits=sem_credits
            )
        )
        total_weighted_sgpa += sem_sgpa * sem_credits
        total_credits += sem_credits
        
    cgpa = round(total_weighted_sgpa / total_credits, 2) if total_credits > 0 else 0.0
    semester_details.sort(key=lambda x: x.semester)
    
    return CgpaResponse(
        cgpa=cgpa,
        total_credits=total_credits,
        semesters=semester_details
    )


@router.post(
    "/cgpa/predict/{student_id}",
    response_model=CgpaPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict CGPA changes with hypothetical grades",
)
async def predict_cgpa(
    student_id: int,
    body: list[CgpaPredictionItem],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> CgpaPredictionResponse:
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only simulate CGPA for themselves",
        )
        
    await _get_student_or_404(student_id, db)
    
    # Map predictions body
    pred_map = {item.course_id: item.expected_marks for item in body}
    
    # Look up all courses in predictions
    if pred_map:
        course_stmt = select(Course).where(Course.id.in_(list(pred_map.keys())))
        course_res = await db.execute(course_stmt)
        predicted_courses = {c.id: c for c in course_res.scalars().all()}
        for cid in pred_map:
            if cid not in predicted_courses:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {cid} not found",
                )
    else:
        predicted_courses = {}
        
    # Fetch existing grades
    stmt = select(Grade).where(Grade.student_id == student_id)
    res = await db.execute(stmt)
    existing_grades = res.scalars().all()
    
    # 1. Calculate current CGPA (10-point scale)
    curr_sem_groups = defaultdict(list)
    for g in existing_grades:
        curr_sem_groups[g.semester].append(g)
        
    curr_sem_details = {}
    curr_total_weighted = 0.0
    curr_total_credits = 0
    for sem, s_grades in curr_sem_groups.items():
        sem_weighted = 0.0
        sem_credits = 0
        for g in s_grades:
            credits = g.course.credits if g.course else 3
            points = _get_10_point_gpa(g.marks)
            sem_weighted += points * credits
            sem_credits += credits
        sem_sgpa = round(sem_weighted / sem_credits, 2) if sem_credits > 0 else 0.0
        curr_sem_details[sem] = {"sgpa": sem_sgpa, "credits": sem_credits}
        curr_total_weighted += sem_sgpa * sem_credits
        curr_total_credits += sem_credits
        
    current_cgpa = round(curr_total_weighted / curr_total_credits, 2) if curr_total_credits > 0 else 0.0
    
    # 2. Calculate predicted CGPA
    # Start with existing courses, but replace marks if course_id is in predictions
    simulated_courses_by_sem = defaultdict(list)
    replaced_course_ids = set()
    
    for g in existing_grades:
        credits = g.course.credits if g.course else 3
        if g.course_id in pred_map:
            simulated_marks = pred_map[g.course_id]
            points = _get_10_point_gpa(simulated_marks)
            replaced_course_ids.add(g.course_id)
        else:
            simulated_marks = g.marks
            points = _get_10_point_gpa(g.marks)
            
        simulated_courses_by_sem[g.semester].append({
            "credits": credits,
            "points": points
        })
        
    # Add new courses (predicted courses that student hasn't taken yet)
    for cid, expected_marks in pred_map.items():
        if cid not in replaced_course_ids:
            course_obj = predicted_courses[cid]
            simulated_courses_by_sem[course_obj.semester].append({
                "credits": course_obj.credits,
                "points": _get_10_point_gpa(expected_marks)
            })
            
    # Calculate simulated SGPAs and overall CGPA
    breakdown = []
    pred_total_weighted = 0.0
    pred_total_credits = 0
    
    # Combine semesters
    all_semesters = sorted(list(simulated_courses_by_sem.keys()))
    
    for sem in all_semesters:
        sem_weighted = 0.0
        sem_credits = 0
        for item in simulated_courses_by_sem[sem]:
            sem_weighted += item["points"] * item["credits"]
            sem_credits += item["credits"]
            
        pred_sgpa = round(sem_weighted / sem_credits, 2) if sem_credits > 0 else 0.0
        breakdown.append(
            SemesterBreakdownItem(
                semester=sem,
                sgpa=pred_sgpa,
                credits=sem_credits
            )
        )
        pred_total_weighted += pred_sgpa * sem_credits
        pred_total_credits += sem_credits
        
    predicted_cgpa = round(pred_total_weighted / pred_total_credits, 2) if pred_total_credits > 0 else 0.0
    difference = round(predicted_cgpa - current_cgpa, 2)
    
    if difference > 0.0:
        impact = "positive"
    elif difference < 0.0:
        impact = "negative"
    else:
        impact = "neutral"
        
    return CgpaPredictionResponse(
        current_cgpa=current_cgpa,
        predicted_cgpa=predicted_cgpa,
        difference=difference,
        impact=impact,
        breakdown=breakdown,
    )



