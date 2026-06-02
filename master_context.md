## PROJECT CONTEXT — College Student Management System
Read this entire context before generating any code.

### Tech Stack
Backend:
- FastAPI (fully async, all endpoints use async/await)
- PostgreSQL via SQLAlchemy 2.0 async ORM
- JWT authentication with role-based access (admin/teacher/student)
- Pydantic v2 for validation
- Passlib/bcrypt for password hashing
- Docker + docker-compose
- slowapi rate limiting (100 req/min per IP)
- fastapi-cache2 InMemoryBackend
- Custom ASGI logging middleware

Frontend:
- React 18 + Vite
- Tailwind CSS (utility classes only)
- React Router v6
- Axios with JWT Bearer interceptor
- TanStack React Query v5 (useQuery, useMutation, useQueryClient)
- React Hook Form
- Recharts for charts
- react-hot-toast for notifications

### Color Theme (strict)
- Sidebar bg: #0f172a
- Sidebar active: #1e3a5f
- Main bg: #f8fafc
- Card bg: #ffffff, border: #e2e8f0
- Primary button: #1e3a5f → hover #0f172a
- Text primary: #0f172a, secondary: #475569, muted: #94a3b8
- Status green: #16a34a, red: #dc2626, amber: #d97706

### Roles & Access
Admin   → full system access
Teacher → view students only, mark attendance, input grades,
          upload material, review leave, post notices
Student → view own data only, submit leave, view fees,
          download material, view notices

### Database Schema (15 tables)
attendance:      id, student_id, course_id, class_id, date, status, marked_by, created_at
classes:         id, name, department_id, year, semester
courses:         id, name, code, department_id, credits, semester
departments:     id, name, code
enrollment:      id, student_id, class_id
fees:            id, student_id, amount, fee_type, status, due_date, paid_date, created_at
grades:          id, student_id, course_id, marks, grade, semester, academic_year, created_at
leave_requests:  id, student_id, teacher_id, reason, from_date, to_date, status, created_at
notice_board:    id, author_id, title, content, target_role, class_id, created_at
roles:           id, name
student_profile: id, user_id, department_id, class_id, roll_number, dob, blood_group,
                 phone, address, emergency_contact, profile_photo
study_materials: id, teacher_id, course_id, title, description, file_path,
                 file_type, file_size, created_at
timetable:       id, class_id, course_id, teacher_id, day, start_time, end_time, room
users:           id, username, email, password_hash, role_id, is_active, created_at

### All API Endpoints
POST /auth/login          body: {username, password}
GET  /auth/me

POST /users               body: {username, email, password, role_id}
GET  /users               query: role_id, role, username, skip, limit
GET  /users/{id}
PUT  /users/{id}          body: {username?, email?, password?, role_id?, is_active?}
DELETE /users/{id}
POST /users/import        body: multipart/form-data {file} (CSV upload)

POST /departments         body: {name, code}
GET  /departments         query: skip, limit
GET  /departments/{id}
PUT  /departments/{id}    body: {name?, code?}
DELETE /departments/{id}

POST /courses             body: {name, code, department_id, credits, semester}
GET  /courses             query: department_id, skip, limit
GET  /courses/{id}
PUT  /courses/{id}        body: {name?, code?, department_id?, credits?, semester?}
DELETE /courses/{id}

POST /classes             body: {name, department_id, year, semester}
GET  /classes             query: department_id, skip, limit
GET  /classes/{id}
PUT  /classes/{id}        body: {name?, department_id?, year?, semester?}
DELETE /classes/{id}

POST /profile             body: {user_id, department_id, class_id, roll_number, dob?,
                                 blood_group?, phone?, address?, emergency_contact?}
GET  /profile/me
PUT  /profile/me          body: same fields optional
GET  /profile/{user_id}

POST /enrollment          body: {student_id, class_id}
GET  /enrollment/class/{class_id}
DELETE /enrollment/{id}

POST /attendance          body: {student_id, course_id, class_id, date, status}
GET  /attendance          query: student_id, course_id, class_id, start_date, end_date, status, skip, limit
GET  /attendance/student/{id}   query: course_id, start_date, end_date, status, skip, limit
GET  /attendance/class/{id}     query: course_id, start_date, end_date, status, skip, limit
GET  /attendance/percentage/{id}
GET  /attendance/predictor/{id}
POST /attendance/bulk           body: {class_id, course_id, date, records: [{student_id, status}]}
GET  /attendance/simulate       query: student_id, course_id, total_planned, planning_to_skip

POST /grades              body: {student_id, course_id, marks, grade, semester, academic_year}
GET  /grades              query: student_id, course_id, semester, academic_year, skip, limit
PUT  /grades/{id}         body: {marks?, grade?, semester?, academic_year?}
GET  /grades/me           query: semester, course_id, academic_year, skip, limit
GET  /grades/class/{id}   query: course_id, semester, skip, limit
GET  /grades/gpa/{id}     query: academic_year
POST /grades/whatif/{id}  body: {course_id, expected_marks}
GET  /grades/result/{student_id} query: semester, academic_year
GET  /grades/report/{student_id} query: semester, academic_year (Returns PDF)
GET  /grades/sgpa/{student_id}   query: semester, academic_year (10-point scale)
GET  /grades/cgpa/{student_id}   (10-point scale)
POST /grades/cgpa/predict/{student_id} body: [{course_id, expected_marks}]

POST /timetable           body: {class_id, course_id, teacher_id, day, start_time, end_time, room}
GET  /timetable/class/{id}      query: day, skip, limit
GET  /timetable/me              query: day, skip, limit
DELETE /timetable/{id}

POST /fees                body: {student_id, amount, fee_type, status, due_date}
GET  /fees                query: student_id, fee_type, status, skip, limit
GET  /fees/me
GET  /fees/student/{id}
GET  /fees/{id}
PUT  /fees/{id}           body: {amount?, fee_type?, status?, due_date?, paid_date?}
DELETE /fees/{id}
POST /fees/{id}/pay       body: {paid_date}
GET  /fees/{id}/receipt   (Returns PDF receipt)

POST /leave               body: {teacher_id, reason, from_date, to_date}
GET  /leave               query: student_id, teacher_id, status, skip, limit
GET  /leave/me
GET  /leave/{id}
DELETE /leave/{id}
POST /leave/{id}/review   body: {status, comment?}
GET  /leave/balance       (Leave balance per semester)

POST /notice              body: {title, content, target_role, class_id?}
GET  /notice              query: skip, limit
GET  /notice/{id}
PUT  /notice/{id}         body: {title?, content?, target_role?, class_id?}
DELETE /notice/{id}

POST /material            body: multipart/form-data {title, course_id, description?, file_type, file}
GET  /material/course/{id}      query: skip, limit
GET  /material/me               query: skip, limit
GET  /material/{id}
DELETE /material/{id}

GET /dashboard/admin
GET /dashboard/teacher
GET /dashboard/student
GET /health

### Frontend File Structure
src/
├── api/
├── components/
│   ├── ui/
│   ├── Modal.jsx
│   ├── Navbar.jsx
│   ├── ProtectedRoute.jsx
│   ├── Sidebar.jsx
│   ├── StatCard.jsx
│   ├── StatusBadge.jsx
│   └── Table.jsx
├── context/AuthContext.jsx
├── layouts/
│   ├── AdminLayout.jsx
│   ├── StudentLayout.jsx
│   └── TeacherLayout.jsx
└── pages/
    ├── admin/
    │   ├── Attendance.jsx, Classes.jsx, Courses.jsx
    │   ├── Dashboard.jsx, Departments.jsx, Enrollments.jsx
    │   ├── Fees.jsx, Notice.jsx, Reports.jsx
    │   ├── Students.jsx, Teachers.jsx, Timetable.jsx, Users.jsx
    ├── auth/Login.jsx
    ├── student/
    │   ├── Attendance.jsx, AttendancePredictor.jsx, Courses.jsx
    │   ├── Dashboard.jsx, Fees.jsx, CgpaSimulator.jsx
    │   ├── Grades.jsx, Leave.jsx, Material.jsx
    │   ├── Notice.jsx, Profile.jsx, Timetable.jsx
    └── teacher/
        ├── Attendance.jsx, Courses.jsx, Dashboard.jsx
        ├── Grades.jsx, Leave.jsx, Material.jsx
        ├── Notice.jsx, Profile.jsx, Students.jsx, Timetable.jsx

### Axios Setup
- baseURL: http://localhost:8000
- Interceptor: adds Authorization: Bearer {token} from localStorage
- On 401: clears localStorage, redirects to /login

### React Query Pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['key'],
  queryFn: () => axiosInstance.get('/endpoint').then(r => r.data)
})

const mutation = useMutation({
  mutationFn: (data) => axiosInstance.post('/endpoint', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['key'])
    toast.success('Success')
  },
  onError: (err) => toast.error(err.response?.data?.detail || 'Error')
})

### Rules for Code Generation

#### Frontend Standards
- Always use TanStack Query v5 for ALL data fetching (no raw axios in components)
- Always use useMutation for POST/PUT/DELETE operations
- Always invalidate relevant queries after mutations
- Always use react-hot-toast for success/error notifications
- Always handle three states: loading (skeleton), error (error card), empty (empty state)
- Use Tailwind utility classes only — no inline styles except dynamic values
- Match module accent color for icons, card headers, and highlights
- Every list page needs: search, filter, pagination
- Every form needs: validation, loading state on submit, error messages below inputs
- Every table needs: sortable headers, hover states, responsive scroll
- Every modal needs: backdrop blur, escape key close, confirm before delete

#### Interactivity Standards
- Skeleton loaders instead of spinners for page load
- Optimistic updates where possible (update UI before API confirms)
- Animated counters on stat cards (0 → value on mount)
- Smooth page transitions (fade + slight translateY)
- Button press feedback (scale 0.98 on active)
- Row hover highlights on all tables
- Toast notifications auto dismiss after 3s
- Form inputs show green checkmark on valid, red border on error

#### Code Quality Standards
- No hardcoded IDs or magic numbers
- Extract reusable logic into custom hooks (useAttendance, useFees etc)
- Destructure props cleanly
- Use optional chaining (?.) for nested data
- Handle API errors with err.response?.data?.detail fallback
- Use queryClient.invalidateQueries after every mutation

#### Output Preferences
- Briefly explain your approach before generating code
- Generate multiple related files together when needed
- Add inline comments for complex logic
- Proactively suggest improvements beyond what was asked
- Point out any bugs or issues you notice in provided code

### Color Theme

Base (all pages):
- Sidebar bg: #0f172a
- Sidebar active: #1e3a5f  
- Main bg: #f8fafc
- Card bg: #ffffff, border: #e2e8f0
- Text primary: #0f172a, secondary: #475569, muted: #94a3b8

Status colors (consistent everywhere):
- Present/Paid/Approved/Active:  #16a34a (green)
- Absent/Overdue/Rejected:       #dc2626 (red)
- Late/Pending/Warning:          #d97706 (amber)
- Detained/Critical:             #991b1b (dark red)

Button colors:
- Primary action:  #1e3a5f → hover #0f172a
- Secondary:       white, border #e2e8f0 → hover #f8fafc
- Danger:          white, border #dc2626 → hover #dc2626 white text
- Success:         white, border #16a34a → hover #16a34a white text