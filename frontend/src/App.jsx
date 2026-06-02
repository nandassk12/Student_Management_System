import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import ProtectedRoute from '@components/ProtectedRoute.jsx'
import PageLoader     from '@components/ui/PageLoader.jsx'
import AdminLayout    from '@/layouts/AdminLayout.jsx'
import TeacherLayout  from '@/layouts/TeacherLayout.jsx'
import StudentLayout  from '@/layouts/StudentLayout.jsx'

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Auth
const Login = lazy(() => import('@pages/auth/Login.jsx'))

// Admin
const AdminDashboard      = lazy(() => import('@pages/admin/Dashboard.jsx'))
const AdminUsers          = lazy(() => import('@pages/admin/Users.jsx'))
const AdminStudents       = lazy(() => import('@pages/admin/Students.jsx'))
const AdminTeachers       = lazy(() => import('@pages/admin/Teachers.jsx'))
const AdminCourses        = lazy(() => import('@pages/admin/Courses.jsx'))
const AdminDepartments    = lazy(() => import('@pages/admin/Departments.jsx'))
const AdminClasses        = lazy(() => import('@pages/admin/Classes.jsx'))
const AdminEnrollments    = lazy(() => import('@pages/admin/Enrollments.jsx'))
const AdminFees           = lazy(() => import('@pages/admin/Fees.jsx'))
const AdminAttendance     = lazy(() => import('@pages/admin/Attendance.jsx'))
const AdminLogs           = lazy(() => import('@pages/admin/Logs.jsx'))
const AdminNotice         = lazy(() => import('@pages/admin/Notice.jsx'))
const AdminTimetable      = lazy(() => import('@pages/admin/Timetable.jsx'))
const AdminLeave          = lazy(() => import('@pages/admin/Leave.jsx'))
const AdminAiAnalytics    = lazy(() => import('@pages/admin/AiAdmin.jsx'))
const AdminUserDocuments  = lazy(() => import('@pages/admin/UserDocuments.jsx'))

// Teacher
const TeacherDashboard    = lazy(() => import('@pages/teacher/Dashboard.jsx'))
const TeacherCourses      = lazy(() => import('@pages/teacher/Courses.jsx'))
const TeacherAttendance   = lazy(() => import('@pages/teacher/Attendance.jsx'))
const TeacherGrades       = lazy(() => import('@pages/teacher/Grades.jsx'))
const TeacherStudents     = lazy(() => import('@pages/teacher/Students.jsx'))
const TeacherProfile      = lazy(() => import('@pages/teacher/Profile.jsx'))
const TeacherMaterial     = lazy(() => import('@pages/teacher/Material.jsx'))
const TeacherLeave        = lazy(() => import('@pages/teacher/Leave.jsx'))
const TeacherNotice       = lazy(() => import('@pages/teacher/Notice.jsx'))
const TeacherTimetable    = lazy(() => import('@pages/teacher/Timetable.jsx'))
const TeacherReports      = lazy(() => import('@pages/teacher/Reports.jsx'))


// Student
const StudentDashboard    = lazy(() => import('@pages/student/Dashboard.jsx'))
const StudentCourses      = lazy(() => import('@pages/student/Courses.jsx'))
const StudentAttendance   = lazy(() => import('@pages/student/Attendance.jsx'))
const StudentGrades       = lazy(() => import('@pages/student/Grades.jsx'))
const StudentFees         = lazy(() => import('@pages/student/Fees.jsx'))
const StudentProfile      = lazy(() => import('@pages/student/Profile.jsx'))
const StudentAttendancePredictor = lazy(() => import('@pages/student/AttendancePredictor.jsx'))
const StudentCgpaSimulator = lazy(() => import('@pages/student/CgpaSimulator.jsx'))
const StudentTimetable    = lazy(() => import('@pages/student/Timetable.jsx'))
const StudentMaterial     = lazy(() => import('@pages/student/Material.jsx'))
const StudentLeave        = lazy(() => import('@pages/student/Leave.jsx'))
const StudentNotice       = lazy(() => import('@pages/student/Notice.jsx'))
const StudentReports      = lazy(() => import('@pages/student/Reports.jsx'))


// Shared
const NotFound = lazy(() => import('@pages/NotFound.jsx'))
const Unauthorized = lazy(() => import('@pages/Unauthorized.jsx'))

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ── Public ── */}
        <Route path="/login"        element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* ── Root redirect ── */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ════════════════════════════════════════════════════════════════
            ADMIN routes
        ════════════════════════════════════════════════════════════════ */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin">
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard"   element={<AdminDashboard />} />
              <Route path="users"       element={<AdminUsers />} />
              <Route path="students"    element={<AdminStudents />} />
              <Route path="teachers"    element={<AdminTeachers />} />
              <Route path="courses"     element={<AdminCourses />} />
              <Route path="departments" element={<AdminDepartments />} />
              <Route path="classes"     element={<AdminClasses />} />
              <Route path="enrollments" element={<AdminEnrollments />} />
              <Route path="fees"        element={<AdminFees />} />
              <Route path="attendance"  element={<AdminAttendance />} />
              <Route path="logs"        element={<AdminLogs />} />
              <Route path="notice"      element={<AdminNotice />} />
              <Route path="timetable"   element={<AdminTimetable />} />
              <Route path="leave"       element={<AdminLeave />} />
              <Route path="users/:user_id/documents" element={<AdminUserDocuments />} />

              {/* AI Analytics — sub-tab routing */}
              <Route path="ai"          element={<AdminAiAnalytics activeTab="health" />} />
              <Route path="ai/health"   element={<AdminAiAnalytics activeTab="health" />} />
              <Route path="ai/departments" element={<AdminAiAnalytics activeTab="departments" />} />
              <Route path="ai/teachers" element={<AdminAiAnalytics activeTab="teachers" />} />

            </Route>
          </Route>
        </Route>

        {/* ════════════════════════════════════════════════════════════════
            TEACHER routes
        ════════════════════════════════════════════════════════════════ */}
        <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
          <Route element={<TeacherLayout />}>
            <Route path="/teacher">
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard"  element={<TeacherDashboard />} />
              <Route path="courses"    element={<TeacherCourses />} />
              <Route path="attendance" element={<TeacherAttendance />} />
              <Route path="grades"     element={<TeacherGrades />} />
              <Route path="students"   element={<TeacherStudents />} />
              <Route path="profile"    element={<TeacherProfile />} />
              <Route path="material"   element={<TeacherMaterial />} />
              <Route path="leave"      element={<TeacherLeave />} />
              <Route path="notice"     element={<TeacherNotice />} />
              <Route path="timetable"  element={<TeacherTimetable />} />
              <Route path="reports"    element={<TeacherReports />} />
            </Route>
          </Route>
        </Route>

        {/* ════════════════════════════════════════════════════════════════
            STUDENT routes
        ════════════════════════════════════════════════════════════════ */}
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route element={<StudentLayout />}>
            <Route path="/student">
              <Route index element={<Navigate to="/student/dashboard" replace />} />
              <Route path="dashboard"  element={<StudentDashboard />} />
              <Route path="courses"    element={<StudentCourses />} />
              <Route path="attendance" element={<StudentAttendance />} />
              <Route path="grades"     element={<StudentGrades />} />
              <Route path="fees"       element={<StudentFees />} />
              <Route path="profile"    element={<StudentProfile />} />
              <Route path="predictor"  element={<StudentAttendancePredictor />} />
              <Route path="gpa-whatif" element={<StudentCgpaSimulator />} />
              <Route path="timetable"  element={<StudentTimetable />} />
              <Route path="material"   element={<StudentMaterial />} />
              <Route path="leave"      element={<StudentLeave />} />
              <Route path="notice"     element={<StudentNotice />} />
              <Route path="reports"    element={<StudentReports />} />
            </Route>
          </Route>
        </Route>

        {/* ── 404 catch-all ── */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Suspense>
  )
}
