"""
app/services/admin_data.py
──────────────────────────
Data-layer queries that power the three AI Admin analytics endpoints:
  1. Institutional Health Dashboard  (/ai/admin/health)
  2. Department Comparison Report    (/ai/admin/departments/report)
  3. Teacher Activity Monitor        (/ai/admin/teachers/activity)

All functions are async and accept an AsyncSession.
They return plain Python dicts / lists — no ORM objects
are exposed to the API layer so that serialisation is trivial.
"""

from __future__ import annotations

import datetime
from typing import Any

from sqlalchemy import func, select, case, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

# ── Model imports ─────────────────────────────────────────────────────────────
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from app.models.student_profile import StudentProfile
from app.models.attendance import Attendance
from app.models.grade import Grade, GRADE_GPA_MAP
from app.models.fee import Fee
from app.models.leave import LeaveRequest
from app.models.notice import Notice
from app.models.material import StudyMaterial
from app.models.timetable import Timetable
from app.models.course import Course


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _grade_to_gpa(letter: str) -> float:
    return GRADE_GPA_MAP.get(letter.strip().upper(), 0.0)


def _semester_label(offset: int) -> str:
    """Human-readable label for trending. offset=0 → current, -1 → previous…"""
    labels = {0: "Current", -1: "Prev Sem", -2: "2 Sems Ago"}
    return labels.get(offset, f"Offset {offset}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Institutional-level aggregate metrics  (for health dashboard)
# ─────────────────────────────────────────────────────────────────────────────

async def available_health_semesters(db: AsyncSession) -> list[dict]:
    """Return list of unique (semester, academic_year) pairs that have grade data."""
    res = await db.execute(
        select(Grade.semester, Grade.academic_year)
        .distinct()
        .order_by(Grade.academic_year.desc(), Grade.semester.desc())
    )
    rows = res.all()
    return [{"semester": r.semester, "academic_year": r.academic_year} for r in rows]


async def institutional_health_metrics(
    db: AsyncSession,
    semester: int | None = None,
    academic_year: str | None = None,
) -> dict[str, Any]:

    """
    Returns a single dict with current-semester aggregates:
      - total_students, total_teachers, total_departments
      - avg_cgpa, avg_attendance_pct
      - fee_collection_rate (paid / total)
      - detention_risk_count (students with attendance < 75 %)
      - pending_leaves_count
      - leave_spike (bool — this week vs semester average)
      - generated_at (ISO string)
    """
    now = datetime.datetime.utcnow()

    # ── Count totals ──────────────────────────────────────────────────────────
    student_role = await db.execute(select(Role).where(Role.name == "student"))
    student_role_obj = student_role.scalar_one_or_none()
    teacher_role = await db.execute(select(Role).where(Role.name == "teacher"))
    teacher_role_obj = teacher_role.scalar_one_or_none()

    student_count_res = await db.execute(
        select(func.count(User.id)).where(
            User.role_id == student_role_obj.id,
            User.is_active.is_(True)
        )
    ) if student_role_obj else None
    total_students = student_count_res.scalar() if student_count_res else 0

    teacher_count_res = await db.execute(
        select(func.count(User.id)).where(
            User.role_id == teacher_role_obj.id,
            User.is_active.is_(True)
        )
    ) if teacher_role_obj else None
    total_teachers = teacher_count_res.scalar() if teacher_count_res else 0

    dept_count_res = await db.execute(select(func.count(Department.id)))
    total_departments = dept_count_res.scalar() or 0

    # ── Average CGPA (optionally filtered by semester / academic_year) ──────────
    grade_filter = []
    if semester is not None:
        grade_filter.append(Grade.semester == semester)
    if academic_year is not None:
        grade_filter.append(Grade.academic_year == academic_year)

    grade_q = select(Grade.grade)
    if grade_filter:
        grade_q = grade_q.where(*grade_filter)
    grades_res = await db.execute(grade_q)
    all_grades = grades_res.scalars().all()
    if all_grades:
        gpa_values = [_grade_to_gpa(g) for g in all_grades]
        avg_cgpa = round(sum(gpa_values) / len(gpa_values), 2)
    else:
        avg_cgpa = 0.0

    # ── Average attendance % ──────────────────────────────────────────────────
    att_res = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case((Attendance.status.in_(["present", "late"]), 1), else_=0)
            ).label("present")
        )
    )
    att_row = att_res.one()
    att_total = att_row.total or 0
    att_present = att_row.present or 0
    avg_attendance_pct = round((att_present / att_total * 100) if att_total > 0 else 0, 1)

    # ── Fee collection rate ───────────────────────────────────────────────────
    fee_res = await db.execute(
        select(
            func.count(Fee.id).label("total"),
            func.sum(case((Fee.status == "paid", 1), else_=0)).label("paid")
        )
    )
    fee_row = fee_res.one()
    fee_total = fee_row.total or 0
    fee_paid = fee_row.paid or 0
    fee_collection_rate = round((fee_paid / fee_total * 100) if fee_total > 0 else 0, 1)

    # ── Detention risk: students with attendance < 75 % ───────────────────────
    # Per student aggregate — build a dict {student_id: att_pct}
    per_student_att_res = await db.execute(
        select(
            Attendance.student_id,
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status.in_(["present", "late"]), 1), else_=0)).label("present")
        ).group_by(Attendance.student_id)
    )
    per_student_rows = per_student_att_res.all()
    student_att_pct = {
        r.student_id: (r.present / r.total * 100) if r.total > 0 else 100.0
        for r in per_student_rows
    }
    detention_risk_count = sum(1 for pct in student_att_pct.values() if pct < 75)

    # ── Per-dept detention breakdown (Chart A) ────────────────────────────────
    depts_for_breakdown = await db.execute(select(Department))
    all_depts = depts_for_breakdown.scalars().all()

    dept_detention = []
    dept_academic = []  # for Chart B — CGPA + Attendance per dept

    for dept in all_depts:
        sp_res = await db.execute(
            select(StudentProfile.user_id).where(StudentProfile.department_id == dept.id)
        )
        dept_student_ids = list(sp_res.scalars().all())
        if not dept_student_ids:
            continue

        dept_total = len(dept_student_ids)
        dept_at_risk = sum(
            1 for sid in dept_student_ids
            if student_att_pct.get(sid, 100.0) < 75
        )
        dept_att_avg = round(
            sum(student_att_pct.get(sid, 100.0) for sid in dept_student_ids) / dept_total, 1
        )

        # Status tier for colour coding
        risk_pct = (dept_at_risk / dept_total * 100) if dept_total else 0
        if risk_pct >= 20:
            risk_status = "critical"
        elif risk_pct >= 10:
            risk_status = "warning"
        else:
            risk_status = "ok"

        dept_detention.append({
            "dept_name": dept.name,
            "risk_count": dept_at_risk,
            "total_students": dept_total,
            "risk_pct": round(risk_pct, 1),
            "status": risk_status,
        })

        # CGPA for this dept (respect semester filter)
        dept_grade_q = select(Grade.grade).where(Grade.student_id.in_(dept_student_ids))
        if grade_filter:
            dept_grade_q = dept_grade_q.where(*grade_filter)
        dg_res = await db.execute(dept_grade_q)
        dg = dg_res.scalars().all()
        dept_cgpa = round(
            sum(_grade_to_gpa(g) for g in dg) / len(dg) if dg else 0, 2
        )
        dept_academic.append({
            "dept_name": dept.name,
            "cgpa": dept_cgpa,
            # Convert 4.0 scale to percentage for comparable chart axis
            "cgpa_pct": round(dept_cgpa / 4.0 * 100, 1),
            "attendance": dept_att_avg,
        })

    # Sort by risk count descending for Chart A
    dept_detention.sort(key=lambda d: d["risk_count"], reverse=True)

    # ── Pending leaves ────────────────────────────────────────────────────────
    pending_leaves_res = await db.execute(
        select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "pending")
    )
    pending_leaves_count = pending_leaves_res.scalar() or 0

    # ── Leave spike detection + 8-week timeline (Chart D) ────────────────────
    week_ago = now.date() - datetime.timedelta(days=7)
    this_week_res = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.created_at >= week_ago
        )
    )
    this_week_leaves = this_week_res.scalar() or 0

    total_leaves_res = await db.execute(select(func.count(LeaveRequest.id)))
    total_leaves = total_leaves_res.scalar() or 0

    # Approximate semester ≈ 16 weeks; weekly average = total / 16
    weekly_avg = total_leaves / 16.0 if total_leaves > 0 else 0
    leave_spike = this_week_leaves > (weekly_avg * 1.5)

    # Build 8-week leave timeline
    weekly_leaves = []
    for i in range(7, -1, -1):
        week_start = now.date() - datetime.timedelta(days=(i + 1) * 7)
        week_end = now.date() - datetime.timedelta(days=i * 7)
        wk_res = await db.execute(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.created_at >= week_start,
                LeaveRequest.created_at < week_end
            )
        )
        wk_count = wk_res.scalar() or 0
        label = f"W{8 - i}" if i > 0 else "This Wk"
        weekly_leaves.append({"week": label, "count": wk_count})

    # ── Previous semester CGPA for Chart B drift comparison ──────────────────
    # Get two most-recent semesters from grades
    # Look for adjacent semester for drift comparison
    prev_sem_q = select(Grade.semester, Grade.academic_year).distinct().order_by(
        Grade.academic_year.desc(), Grade.semester.desc()
    )
    if semester is not None:
        # Exclude the currently-selected semester so we get the one before it
        prev_sem_q = prev_sem_q.where(
            (Grade.semester != semester) | (Grade.academic_year != (academic_year or ""))
        )
    sems_res = await db.execute(prev_sem_q.limit(2))
    available_sems_rows = sems_res.all()
    available_sems = [r.semester for r in available_sems_rows]

    prev_avg_cgpa = avg_cgpa  # default: same if no historical data
    if available_sems:
        prev_sem = available_sems[0]
        prev_sem_yr = available_sems_rows[0].academic_year if available_sems_rows else None
        prev_grades_q = select(Grade.grade).where(Grade.semester == prev_sem)
        if prev_sem_yr:
            prev_grades_q = prev_grades_q.where(Grade.academic_year == prev_sem_yr)
        prev_grades_res = await db.execute(prev_grades_q)
        prev_grades = prev_grades_res.scalars().all()
        if prev_grades:
            prev_avg_cgpa = round(
                sum(_grade_to_gpa(g) for g in prev_grades) / len(prev_grades), 2
            )

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_departments": total_departments,
        "avg_cgpa": avg_cgpa,
        "prev_avg_cgpa": prev_avg_cgpa,
        "avg_attendance_pct": avg_attendance_pct,
        "fee_collection_rate": fee_collection_rate,
        "fee_benchmark": 85.0,
        "detention_risk_count": detention_risk_count,
        "dept_detention": dept_detention,
        "dept_academic": dept_academic,
        "pending_leaves_count": pending_leaves_count,
        "this_week_leaves": this_week_leaves,
        "leave_spike": leave_spike,
        "weekly_avg_leaves": round(weekly_avg, 1),
        "weekly_leaves": weekly_leaves,
        "generated_at": now.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Department Comparison Metrics  (for dept report)
# ─────────────────────────────────────────────────────────────────────────────

async def dept_comparison_metrics(
    db: AsyncSession,
    semester: int | None = None,
    academic_year: str | None = None,
) -> dict[str, Any]:
    """
    Returns the exact API contract shape for the Department Comparison Report:
      absolute_trends  — 3-semester line chart data per dept per metric
      variance_deltas  — delta(current - prev) per dept per metric
      rankings         — sorted by current-sem metric value with delta
      raw_depts        — kept for legacy compatibility / PDF rendering
    """
    depts_res = await db.execute(select(Department))
    departments = depts_res.scalars().all()

    # ── Discover the 3 most-recent (semester, academic_year) combos ───────────
    sem_q = (
        select(Grade.semester, Grade.academic_year)
        .distinct()
        .order_by(Grade.academic_year.desc(), Grade.semester.desc())
    )
    if semester is not None:
        sem_q = sem_q.where(Grade.semester <= semester)
    if academic_year is not None:
        sem_q = sem_q.where(Grade.academic_year <= academic_year)

    sems_res = await db.execute(sem_q.limit(3))
    sem_rows = sems_res.all()  # newest first
    # We need oldest→newest for trend display
    sem_rows_asc = list(reversed(sem_rows))  # [oldest, middle, current]

    LABELS = ["Semester -2", "Semester -1", "Current Sem"]
    # Pad with Nones if fewer than 3 semesters of data
    while len(sem_rows_asc) < 3:
        sem_rows_asc.insert(0, None)

    # ── Helper: CGPA for a dept+students in a given semester/year ─────────────
    async def dept_cgpa_for_sem(student_ids: list[int], sem: int, yr: str) -> float:
        if not student_ids:
            return 0.0
        g_res = await db.execute(
            select(Grade.grade).where(
                Grade.student_id.in_(student_ids),
                Grade.semester == sem,
                Grade.academic_year == yr,
            )
        )
        gs = g_res.scalars().all()
        return round(sum(_grade_to_gpa(g) for g in gs) / len(gs), 2) if gs else 0.0

    # ── Helper: Attendance % for dept students (no semester scope — overall) ───
    async def dept_att(student_ids: list[int]) -> float:
        if not student_ids:
            return 0.0
        a_res = await db.execute(
            select(
                func.count(Attendance.id).label("total"),
                func.sum(case((Attendance.status.in_(["present", "late"]), 1), else_=0)).label("present")
            ).where(Attendance.student_id.in_(student_ids))
        )
        row = a_res.one()
        return round((row.present / row.total * 100) if row.total else 0, 1)

    # ── Helper: Fee rate for dept students ────────────────────────────────────
    async def dept_fee(student_ids: list[int]) -> float:
        if not student_ids:
            return 0.0
        f_res = await db.execute(
            select(
                func.count(Fee.id).label("total"),
                func.sum(case((Fee.status == "paid", 1), else_=0)).label("paid")
            ).where(Fee.student_id.in_(student_ids))
        )
        row = f_res.one()
        return round((row.paid / row.total * 100) if row.total else 0, 1)

    # ── Helper: Detention risk count for dept students ─────────────────────────
    async def dept_detention(student_ids: list[int]) -> int:
        if not student_ids:
            return 0
        ps_res = await db.execute(
            select(
                Attendance.student_id,
                func.count(Attendance.id).label("total"),
                func.sum(case((Attendance.status.in_(["present", "late"]), 1), else_=0)).label("present")
            ).where(Attendance.student_id.in_(student_ids)).group_by(Attendance.student_id)
        )
        return sum(1 for r in ps_res.all() if r.total and (r.present / r.total * 100) < 75)

    # ── Build per-dept data across all 3 semester slots ───────────────────────
    # dept_key → camelCase slug for chart (e.g. "Computer Science" → "computerScience")
    def _slug(name: str) -> str:
        import re
        words = re.split(r"[\s_-]+", name.strip())
        if not words:
            return "dept"
        return words[0][0].lower() + words[0][1:] + "".join(w.capitalize() for w in words[1:])

    dept_info: list[dict] = []  # [{name, slug, student_ids, sem_data:[...3 slots...]}]

    for dept in departments:
        sid_res = await db.execute(
            select(StudentProfile.user_id).where(StudentProfile.department_id == dept.id)
        )
        sids = list(sid_res.scalars().all())

        att = await dept_att(sids)
        fee = await dept_fee(sids)
        det = await dept_detention(sids)

        # Compute CGPA per semester slot
        sem_cgpa_list: list[float | None] = []
        for sr in sem_rows_asc:
            if sr is None or not sids:
                sem_cgpa_list.append(None)
            else:
                c = await dept_cgpa_for_sem(sids, sr.semester, sr.academic_year)
                sem_cgpa_list.append(c)

        # Current-sem CGPA (last slot)
        current_cgpa = next((v for v in reversed(sem_cgpa_list) if v is not None), 0.0)
        # Overall CGPA fallback
        if current_cgpa == 0.0 and sids:
            all_g_res = await db.execute(select(Grade.grade).where(Grade.student_id.in_(sids)))
            all_g = all_g_res.scalars().all()
            current_cgpa = round(sum(_grade_to_gpa(g) for g in all_g) / len(all_g), 2) if all_g else 0.0

        dept_info.append({
            "dept_name": dept.name,
            "slug": _slug(dept.name),
            "cgpa": current_cgpa,
            "attendance": att,
            "fee_rate": fee,
            "detention_risk": det,
            "sem_cgpa": sem_cgpa_list,    # [slot-2, slot-1, current]
            "sem_att": [att, att, att],   # attendance not semester-scoped; same for all slots
            "sem_fee": [fee, fee, fee],
        })

    if not dept_info:
        return {
            "absolute_trends": {"cgpa": [], "attendance": [], "fees": []},
            "variance_deltas": {"cgpa": [], "attendance": [], "fees": []},
            "rankings": [],
            "raw_depts": [],
        }

    # ── Build absolute_trends per metric (3 rows: one per semester label) ──────
    def build_trend_rows(value_key: str) -> list[dict]:
        """value_key = 'cgpa' | 'attendance' | 'fee_rate'"""
        rows = []
        for slot_idx, label in enumerate(LABELS):
            row: dict = {"semester": label}
            for di in dept_info:
                if value_key == "cgpa":
                    v = di["sem_cgpa"][slot_idx]
                elif value_key == "attendance":
                    v = di["sem_att"][slot_idx]
                else:  # fees
                    v = di["sem_fee"][slot_idx]
                row[di["slug"]] = v if v is not None else 0.0
            rows.append(row)
        return rows

    absolute_trends = {
        "cgpa":       build_trend_rows("cgpa"),
        "attendance": build_trend_rows("attendance"),
        "fees":       build_trend_rows("fee_rate"),
    }

    # ── Build variance_deltas: Δ = current − prev for CGPA and attendance ─────
    def build_variance(value_key: str) -> list[dict]:
        deltas = []
        for di in dept_info:
            if value_key == "cgpa":
                curr = di["sem_cgpa"][2]
                prev = di["sem_cgpa"][1]
            else:
                curr = di["sem_att"][2]
                prev = di["sem_att"][1]
            if curr is None or prev is None:
                delta = 0.0
            else:
                delta = round(curr - prev, 2)
            deltas.append({"department": di["dept_name"], "deltaValue": delta})
        return sorted(deltas, key=lambda d: d["deltaValue"])

    variance_deltas = {
        "cgpa":       build_variance("cgpa"),
        "attendance": build_variance("cgpa"),   # proxy until per-sem att available
    }

    # ── Rankings by current attendance (highest first) ────────────────────────
    sorted_by_att = sorted(dept_info, key=lambda d: d["attendance"], reverse=True)
    rankings = [
        {
            "rank": i + 1,
            "department": di["dept_name"],
            "value": f"{di['attendance']}%",
            "delta": next(
                (x["deltaValue"] for x in variance_deltas["attendance"]
                 if x["department"] == di["dept_name"]), 0.0
            ),
            "cgpa": di["cgpa"],
            "fee_rate": di["fee_rate"],
            "detention_risk": di["detention_risk"],
        }
        for i, di in enumerate(sorted_by_att)
    ]

    # Build raw_depts for backwards compat (PDF export)
    raw_depts = [
        {
            "dept_id": None,
            "dept_name": di["dept_name"],
            "cgpa": di["cgpa"],
            "attendance": di["attendance"],
            "fee_rate": di["fee_rate"],
            "detention_risk": di["detention_risk"],
            "slug": di["slug"],
        }
        for di in dept_info
    ]

    return {
        "absolute_trends": absolute_trends,
        "variance_deltas": variance_deltas,
        "rankings": rankings,
        "raw_depts": raw_depts,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Teacher Activity Completeness  (for teacher monitor)
# ─────────────────────────────────────────────────────────────────────────────

async def teacher_activity_completeness(db: AsyncSession) -> list[dict[str, Any]]:
    """
    Returns a list of teacher dicts, each with:
      teacher_id, teacher_name,
      activities: {
        grades_entered: "ok" | "warning" | "critical",
        materials_uploaded: "ok" | "warning" | "critical",
        leave_reviewed: "ok" | "warning" | "critical",
        notices_posted: "ok" | "warning" | "critical",
        timetable_covered: "ok" | "warning" | "critical",
      },
      overall_status: "ok" | "warning" | "critical",
      _details: { ... }   ← raw details used by LLM prompt builder
    """
    teacher_role_res = await db.execute(select(Role).where(Role.name == "teacher"))
    teacher_role = teacher_role_res.scalar_one_or_none()
    if not teacher_role:
        return []

    teachers_res = await db.execute(
        select(User).where(User.role_id == teacher_role.id, User.is_active.is_(True))
    )
    teachers = teachers_res.scalars().all()

    now = datetime.datetime.utcnow()
    week_ago = now - datetime.timedelta(days=7)
    stale_leave_cutoff = now - datetime.timedelta(days=7)

    result = []
    for teacher in teachers:
        tid = teacher.id

        # ── 1. Grades entered: has teacher entered ANY grades for assigned courses? ──
        # Get courses this teacher is assigned to via timetable
        tt_res = await db.execute(
            select(Timetable.course_id, Timetable.class_id).where(
                Timetable.teacher_id == tid
            ).distinct()
        )
        tt_rows = tt_res.all()
        assigned_course_ids = list({r.course_id for r in tt_rows})

        if not assigned_course_ids:
            grades_status = "ok"  # no courses to grade
            missing_grade_courses = []
        else:
            # Courses where teacher has NOT entered any grades
            graded_course_ids_res = await db.execute(
                select(Grade.course_id).where(
                    Grade.course_id.in_(assigned_course_ids)
                ).distinct()
            )
            graded_course_ids = set(graded_course_ids_res.scalars().all())
            missing_grade_course_ids = [c for c in assigned_course_ids if c not in graded_course_ids]

            # Fetch course names
            if missing_grade_course_ids:
                cn_res = await db.execute(
                    select(Course.id, Course.name).where(Course.id.in_(missing_grade_course_ids))
                )
                missing_grade_courses = [r.name for r in cn_res.all()]
                grades_status = "critical" if len(missing_grade_courses) >= 2 else "warning"
            else:
                missing_grade_courses = []
                grades_status = "ok"

        # ── 2. Study materials uploaded: at least 1 per assigned course ──────
        if not assigned_course_ids:
            materials_status = "ok"
            missing_material_courses = []
        else:
            mat_res = await db.execute(
                select(StudyMaterial.course_id).where(
                    StudyMaterial.teacher_id == tid,
                    StudyMaterial.course_id.in_(assigned_course_ids)
                ).distinct()
            )
            mat_course_ids = set(mat_res.scalars().all())
            missing_mat_course_ids = [c for c in assigned_course_ids if c not in mat_course_ids]
            if missing_mat_course_ids:
                cn2_res = await db.execute(
                    select(Course.id, Course.name).where(Course.id.in_(missing_mat_course_ids))
                )
                missing_material_courses = [r.name for r in cn2_res.all()]
                materials_status = "critical" if len(missing_material_courses) >= 2 else "warning"
            else:
                missing_material_courses = []
                materials_status = "ok"

        # ── 3. Leave reviewed: no pending leaves older than 7 days ────────────
        stale_leaves_res = await db.execute(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.teacher_id == tid,
                LeaveRequest.status == "pending",
                LeaveRequest.created_at <= stale_leave_cutoff
            )
        )
        stale_count = stale_leaves_res.scalar() or 0
        if stale_count == 0:
            leave_status = "ok"
        elif stale_count <= 2:
            leave_status = "warning"
        else:
            leave_status = "critical"

        # ── 4. Notices posted: at least 1 notice this semester ───────────────
        notices_res = await db.execute(
            select(func.count(Notice.id)).where(Notice.author_id == tid)
        )
        notices_count = notices_res.scalar() or 0
        notices_status = "ok" if notices_count >= 1 else "warning"

        # ── 5. Timetable covered: attendance marked for at least some slots ──
        if not assigned_course_ids:
            timetable_status = "ok"
            unmarked_courses = []
        else:
            # Courses where attendance has been marked (by this teacher as marker)
            marked_res = await db.execute(
                select(Attendance.course_id).where(
                    Attendance.marked_by == tid,
                    Attendance.course_id.in_(assigned_course_ids)
                ).distinct()
            )
            marked_course_ids = set(marked_res.scalars().all())
            unmarked_cids = [c for c in assigned_course_ids if c not in marked_course_ids]
            if unmarked_cids:
                uc_res = await db.execute(
                    select(Course.id, Course.name).where(Course.id.in_(unmarked_cids))
                )
                unmarked_courses = [r.name for r in uc_res.all()]
                timetable_status = "critical" if len(unmarked_courses) >= 2 else "warning"
            else:
                unmarked_courses = []
                timetable_status = "ok"

        # ── Compute overall status ────────────────────────────────────────────
        statuses = [grades_status, materials_status, leave_status, notices_status, timetable_status]
        if "critical" in statuses:
            overall = "critical"
        elif "warning" in statuses:
            overall = "warning"
        else:
            overall = "ok"

        result.append({
            "teacher_id": tid,
            "teacher_name": teacher.username,
            "activities": {
                "grades_entered": grades_status,
                "materials_uploaded": materials_status,
                "leave_reviewed": leave_status,
                "notices_posted": notices_status,
                "timetable_covered": timetable_status,
            },
            "overall_status": overall,
            # Internal details for LLM prompt — will be stripped before returning to client
            "_details": {
                "missing_grade_courses": missing_grade_courses,
                "missing_material_courses": missing_material_courses,
                "stale_leaves_count": stale_count,
                "notices_count": notices_count,
                "unmarked_att_courses": unmarked_courses,
            },
        })

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 4. Prompt builders  (turn raw metrics into LLM-ready prompts)
# ─────────────────────────────────────────────────────────────────────────────

def build_health_prompt(metrics: dict) -> list[dict]:
    """Build messages for the institutional health LLM call."""
    system = (
        "You are an expert educational data analyst AI for a college management system. "
        "You receive real aggregated metrics and produce a structured diagnostic report. "
        "Be concise, data-driven, and highlight critical issues first. "
        "Use 3–5 short paragraphs. Do NOT use markdown headers — use plain prose."
    )
    user = (
        f"Institutional Health Metrics as of {metrics['generated_at'][:10]}:\n"
        f"- Total Students: {metrics['total_students']}\n"
        f"- Total Teachers: {metrics['total_teachers']}\n"
        f"- Total Departments: {metrics['total_departments']}\n"
        f"- Average CGPA (4.0 scale): {metrics['avg_cgpa']}\n"
        f"- Average Attendance: {metrics['avg_attendance_pct']}%\n"
        f"- Fee Collection Rate: {metrics['fee_collection_rate']}%\n"
        f"- Students at Detention Risk (< 75% attendance): {metrics['detention_risk_count']}\n"
        f"- Pending Student Leaves: {metrics['pending_leaves_count']}\n"
        f"- Leave Spike Detected (>1.5x weekly average): {'YES' if metrics['leave_spike'] else 'No'}\n"
        f"  (This week: {metrics['this_week_leaves']} | Weekly avg: {metrics['weekly_avg_leaves']})\n\n"
        "Write a comprehensive institutional health diagnostic report. "
        "Identify the most critical risks and recommend 2–3 specific actionable interventions."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_dept_commentary_prompt(dept_data: dict | list) -> list[dict]:
    """Build messages for the department outlier commentary LLM call.
    Accepts either the new dict shape (with variance_deltas) or the old list shape.
    """
    system = (
        "You are an expert educational analytics AI. "
        "You receive department variance delta arrays showing change from the previous semester. "
        "Write a concise, scannable Markdown paragraph (no headers, use **bold** for dept names). "
        "Identify ONLY localized outliers and anomalies. "
        "Omit departments within healthy baselines. "
        "Be direct and data-driven, max 3 short paragraphs."
    )

    if isinstance(dept_data, dict):
        # New shape: use variance_deltas
        cgpa_deltas = dept_data.get("variance_deltas", {}).get("cgpa", [])
        att_deltas  = dept_data.get("variance_deltas", {}).get("attendance", [])
        lines = ["**CGPA Variance Δ (Current − Previous Semester):**"]
        for d in cgpa_deltas:
            lines.append(f"  • {d['department']}: Δ={d['deltaValue']:+.2f}")
        lines.append("\n**Attendance Variance Δ:**")
        for d in att_deltas:
            lines.append(f"  • {d['department']}: Δ={d['deltaValue']:+.1f}%")
        user_text = "\n".join(lines)
    else:
        # Legacy list shape
        lines = ["Department Metrics (current semester):"]
        for d in dept_data:
            lines.append(
                f"  {d['dept_name']}: CGPA={d['cgpa']}, "
                f"Attendance={d['attendance']}%, "
                f"Fee Collection={d['fee_rate']}%, "
                f"Detention Risk Count={d['detention_risk']}"
            )
        user_text = "\n".join(lines)

    user = (
        user_text + "\n\nEvaluate these variance arrays. "
        "Generate a concise Markdown commentary identifying outliers only — "
        "departments that rank unusually high or low. "
        "Suggest possible explanations and interventions for critical cases."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_teacher_flag_prompt(teacher: dict) -> list[dict]:
    """Build messages for a single-teacher AI flag LLM call."""
    d = teacher["_details"]
    acts = teacher["activities"]

    system = (
        "You are an HR compliance AI for a college. "
        "You flag specific non-compliance issues for teachers and recommend "
        "concrete corrective actions. Be brief and direct. "
        "Each flag should be 1–2 sentences max."
    )

    issues = []
    if acts["grades_entered"] != "ok":
        courses_str = ", ".join(d["missing_grade_courses"]) if d["missing_grade_courses"] else "assigned courses"
        issues.append(f"- Grades not entered for: {courses_str}.")
    if acts["materials_uploaded"] != "ok":
        courses_str = ", ".join(d["missing_material_courses"]) if d["missing_material_courses"] else "assigned courses"
        issues.append(f"- No study materials uploaded for: {courses_str}.")
    if acts["leave_reviewed"] != "ok":
        issues.append(f"- {d['stale_leaves_count']} student leave request(s) pending review for over 7 days.")
    if acts["notices_posted"] != "ok":
        issues.append(f"- No notices posted this term (count: {d['notices_count']}).")
    if acts["timetable_covered"] != "ok":
        courses_str = ", ".join(d["unmarked_att_courses"]) if d["unmarked_att_courses"] else "some courses"
        issues.append(f"- Attendance not marked for: {courses_str}.")

    if not issues:
        return []  # No issues → no LLM call needed

    user = (
        f"Teacher: {teacher['teacher_name']}\n"
        f"Overall compliance status: {teacher['overall_status']}\n\n"
        f"Issues detected:\n" + "\n".join(issues) + "\n\n"
        "For each issue, generate one structured flag object with: "
        "level (critical or warning) and message (1–2 sentence actionable recommendation). "
        "Return ONLY a JSON array of objects: [{\"level\": \"...\", \"message\": \"...\"}]"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_health_chat_prompt(report_content: str, question: str) -> list[dict]:
    """Build messages for the health report chat Q&A."""
    system = (
        "You are an educational analytics assistant. "
        "You are given an institutional health diagnostic report and answer "
        "follow-up questions from the admin concisely and accurately. "
        "Base your answers strictly on the provided report context."
    )
    user = (
        f"DIAGNOSTIC REPORT CONTEXT:\n{report_content}\n\n"
        f"ADMIN QUESTION: {question}\n\n"
        "Answer concisely in 1–3 sentences."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
