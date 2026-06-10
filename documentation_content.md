## PROJECT CONTEXT — College Student Management System

### Project Overview
The College Student Management System is a centralized educational platform that connects students, teachers, and administrators. It simplifies college operations by organizing and managing the following core areas:
- **Role-Based Access Control**: Tailored workflows for Admins (system setup and financial oversight), Teachers (academic tracking, study materials, and reviews), and Students (personal records, simulators, and requests).
- **Core Academic Infrastructure**: Management of departments, courses, classes, timetables (with collision/clash detection), notice boards, and student enrollments.
- **Grades & Financials**: Live calculation of SGPA/CGPA (10-point scale), fee billing tracking, and automated receipt PDF generation.
- **Leave Request Portals**: Structured student leave workflows (reviewed by teachers with semester balance checks) and teacher leave workflows (reviewed by admins).
- **Resource Repository**: File storage database referencing course study materials (PDF, DOCX, MP4, images).
- **AI-Powered Diagnostics**: Auto-generated student performance progress reviews, college-wide institutional health reports (with administrative chat Q&A), and automated teacher compliance activity flags.

### Tech Stack

Backend:
- **FastAPI**: Fully async web framework (0.111.0)
- **PostgreSQL**: Database managed with SQLAlchemy 2.0 type-safe async ORM and `asyncpg` driver
- **Database Migrations**: Alembic (1.13.1)
- **AI/LLM Integration**: OpenWebUI API connection via async `httpx` client (with default models from environment)
- **PDF Generation**: ReportLab (4.5.1) for generating dynamic grades receipts and administrative health reports
- **Authentication**: JWT authentication using `python-jose` with `passlib`/`bcrypt` password hashing
- **Data Validation & Settings**: Pydantic v2 and `pydantic-settings`
- **Rate Limiting**: `slowapi` (IP-based token bucket, 100 req/min limit)
- **Caching**: `fastapi-cache2` using InMemoryBackend
- **Logging**: Custom ASGI middleware routing request latency and statuses to standard output and rolling logs (`logs/app.log`)
- **Deployment**: Docker & Docker Compose containerization

Frontend:
- **Core Library**: React 18 (Vite build system)
- **Styling**: Tailwind CSS v3 (utility classes only)
- **Routing**: React Router v6
- **State Management & Data Fetching**: TanStack React Query v5 (with React Query Devtools)
- **HTTP Client**: Axios with automatic JWT Bearer token interceptor and 401 redirect handling
- **Form Handling**: React Hook Form
- **Data Visualization**: Recharts (for analytics and progress trends)
- **Toast Notifications**: `react-hot-toast` for real-time success/error notifications

### Roles & Access

#### Admin
- **System Administration**: Full system access, including creating and deactivating users, and bulk importing users from CSV.
- **Academic Setup**: Create, read, update, and delete academic entities including departments, courses, classes, and student enrollments.
- **Student Profile Management**: Create and manage student profiles.
- **Leave Management**: Review, approve, or reject teacher leave requests; list and delete leave requests.
- **Fee Management**: Create, update, delete, pay fees, and export receipt PDFs.
- **AI Analytics & Reporting**: Generate and view institutional health reports (with chat Q&A), department comparison reports (with PDF export), teacher compliance activity logs, and approve/bulk-approve AI student reports.
- **Dashboard**: Access the admin analytics dashboard.

#### Teacher
- **Academic Management**: View student lists in assigned classes, mark attendance (single or bulk), and input/manage student grades.
- **Study Materials**: Upload study materials for courses, view uploaded materials, and delete materials they authored.
- **Leave Management**: Submit personal leave requests (reviewed by admins); review, approve, or reject student leave requests assigned to them.
- **Profile & Documents**: View and update teacher-specific profile (personal details, signature, bank credentials, photo) and upload/manage teacher documents.
- **Notice Board**: Post announcements for classes or target roles.
- **Dashboard & Reports**: Access the teacher dashboard and view/generate AI student reports.

#### Student
- **Personal Academic Views**: View own grades, GPA/CGPA calculations, attendance, and weekly timetables.
- **Tools**: Access GPA What-If Simulator and CGPA Predictor.
- **Leave Management**: Submit leave requests (reviewed by assigned teachers), check current semester leave balance, and withdraw/delete pending requests.
- **Fee Obligation**: View personal fees and billing status.
- **Resources**: View notice board announcements and download study materials for enrolled courses.
- **Profile & Documents**: View and update student-specific profile (contact info, address, parent details, photo, signature) and manage student documents.
- **Dashboard**: Access student dashboard analytics.


### AI Powered Features

#### 1. AI Student Progress & Narrative Reports
- **Context Gathering**: Gathers individual student data including overall and subject-wise attendance (specifically tracking core courses like *Neural Networks & DL*, *Machine Learning Fundamentals*, and *Computer Vision*), current CGPA, course grades, historical CGPA trends, and leave records.
- **Advisor Simulation**: The LLM acts as an academic advisor to analyze performance indicators and flag critical risks (such as a drop in class attendance or CGPA declines).
- **Core Risk & Advice Synthesis**: Identifies the primary roadblocks the student faces ("Core Risk") and outlines clear, next-step recommendations for faculty advisors ("Advice").
- **Review & Approval Workflow**: Reports are generated as editable drafts. Teachers can append custom remarks, and Admins can review and approve them (individually or in bulk) to freeze the narrative.
- **Official Export**: Once approved, the narrative and academic status tables are formatted and exported as professional signed PDFs.

#### 2. Institutional Health Reports
- **Institutional Metrics Synthesis**: Consolidates campus-wide metrics including total students/teachers, average CGPA, overall attendance rates, fee collection percentages, leave request statistics, and pending leave backlog.
- **Automated KPI Extraction**: Evaluates compliance thresholds and generates structured alerts for events like *Attendance Crises*, *Detention Risks*, *Fee Collection Gaps*, or *Leave Spikes*.
- **Executive Summary Generation**: Uses the LLM to write a comprehensive executive narrative outlining institutional strengths, weaknesses, department academic/attendance drifts, and structural administrative recommendations.
- **Visualization Datasets**: Pre-calculates datasets to feed interactive charts, including horizontal bar charts for detention risks by department, grouped bar charts for academic drift matrices, fee collection gauges, and area charts for leave spikes.

#### 3. Conversational Health Q&A Chat
- **Context-Aware Analytics**: Feeds the latest institutional health report narrative directly into the LLM context.
- **Natural Language Querying**: Allows Admins to ask questions about the institutional data (e.g., querying specific anomalies, drilling down into department metrics, or asking for academic planning advice) without re-running heavy database queries.
- **Dynamic Response Generation**: Returns concise, conversational answers based on the generated institutional report state.

#### 4. Teacher Compliance & Activity Monitoring
- **Completeness Evaluation**: Tracks teacher activity across five key operational compliance indicators: grades entered, study materials uploaded, leave request reviews, notice postings, and scheduled attendance markings.
- **Automated Flagging & Compliance Severity**: Flags any missing or delayed tasks with status levels (`ok`, `warning`, `critical`).
- **AI Remediation Recommendations**: For non-compliant teachers, the LLM analyzes their specific missing tasks (such as unentered grades or overdue leaves) and generates a structured array of actionable compliance flags containing warning levels and detailed feedback messages.



### Database Schema (20 tables)
ai_health_reports:      id, generated_at, semester, academic_year, content, flags, generated_by
ai_reports:             id, student_id, teacher_id, semester, academic_year, narrative, edited_narrative,
                        risk_flags, status, current_cgpa, overall_attendance, created_at, approved_at
attendance:             id, student_id, course_id, class_id, date, status, marked_by, created_at
classes:                id, name, department_id, year, semester
courses:                id, name, code, department_id, credits, semester
departments:            id, name, code
enrollment:             id, student_id, class_id
fees:                   id, student_id, amount, fee_type, status, due_date, paid_date, created_at
grades:                 id, student_id, course_id, marks, grade, semester, academic_year, created_at
leave_requests:         id, student_id, teacher_id, reason, from_date, to_date, status, created_at
notice_board:           id, author_id, title, content, target_role, class_id, created_at
roles:                  id, name
student_documents:      id, student_id, doc_type, file_name, file_path, uploaded_at
student_profile:        id, user_id, department_id, class_id, roll_number, dob, blood_group, phone, address,
                        emergency_contact, profile_photo, first_name, last_name, gender, nationality, state,
                        year_of_study, batch_year, admission_date, hostel_status, personal_email,
                        current_address, permanent_address, parent_name, parent_relationship, parent_phone,
                        emergency_contact_name, emergency_contact_rel, emergency_contact_phone, signature,
                        profile_completed_pct, last_edited_at
study_materials:        id, teacher_id, course_id, title, description, file_path, file_type, file_size, created_at
teacher_documents:      id, teacher_id, doc_type, file_name, file_path, uploaded_at
teacher_leave_requests: id, teacher_id, admin_id, reason, from_date, to_date, status, created_at
teacher_profile:        id, user_id, department_id, full_name, gender, date_of_birth, employee_id, designation,
                        employment_type, highest_qualification, phone, alternate_phone, profile_photo,
                        signature, personal_email, current_address, permanent_address, emergency_contact_name,
                        emergency_contact_rel, emergency_contact_phone, bank_name, account_number, ifsc_code,
                        profile_completed_pct, last_edited_at
timetable:              id, class_id, course_id, teacher_id, day, start_time, end_time, room
users:                  id, username, email, password_hash, role_id, is_active, created_at


### All API Endpoints

#### Auth (Authentication endpoints)
- **POST** `/auth/login` - Login and obtain JWT access token
- **GET** `/auth/me` - Get current authenticated user

#### Users (User management endpoints)
- **POST** `/users` - Create a new user (admin only)
- **GET** `/users` - List all users (admin only, paginated with filters)
- **GET** `/users/{user_id}` - Get a single user by ID (admin only)
- **PUT** `/users/{user_id}` - Update a user (admin only)
- **DELETE** `/users/{user_id}` - Deactivate a user (admin only — soft delete)
- **POST** `/users/import` - Bulk import users (students/teachers) from CSV file

#### Departments (Department management endpoints)
- **POST** `/departments` - Create a department (admin only)
- **GET** `/departments` - List all departments (any authenticated user)
- **GET** `/departments/{dept_id}` - Get a department by ID (any authenticated user)
- **PUT** `/departments/{dept_id}` - Update a department (admin only)
- **DELETE** `/departments/{dept_id}` - Delete a department (admin only)

#### Courses (Course management endpoints)
- **POST** `/courses` - Create a course (admin only)
- **GET** `/courses` - List courses (any auth user), optionally filter by department
- **GET** `/courses/{course_id}` - Get a course by ID (any authenticated user)
- **PUT** `/courses/{course_id}` - Update a course (admin only)
- **DELETE** `/courses/{course_id}` - Delete a course (admin only)

#### Classes (Class management endpoints)
- **POST** `/classes` - Create a class (admin only)
- **GET** `/classes` - List classes (any auth user), optionally filter by department
- **GET** `/classes/{class_id}` - Get a class by ID (any authenticated user)
- **PUT** `/classes/{class_id}` - Update a class (admin only)
- **DELETE** `/classes/{class_id}` - Delete a class (admin only)

#### Profile (User profile and enrollment endpoints)
- **POST** `/profile` - Admin creates a student profile
- **GET** `/profile/me` - Student views their own profile
- **PUT** `/profile/me` - Student updates their own profile
- **GET** `/profile/{user_id}` - Admin or teacher views any student's profile
- **POST** `/enrollment` - Admin enrolls a student in a class
- **GET** `/enrollment/class/{class_id}` - Teacher or admin views all students in a class
- **GET** `/enrollment/class/{class_id}/students` - Teacher gets slim student list for a class
- **DELETE** `/enrollment/{enrollment_id}` - Admin removes a student enrollment

#### Teacher Profile (Teacher-specific profile endpoints)
- **GET** `/profile/teacher/me` - Teacher views their own profile
- **PUT** `/profile/teacher/me` - Teacher updates their own profile
- **POST** `/profile/teacher/me/photo` - Teacher uploads their profile photo
- **POST** `/profile/teacher/me/signature` - Teacher uploads their signature
- **POST** `/profile/teacher/me/documents` - Teacher uploads a document
- **GET** `/profile/teacher/me/documents` - Teacher lists their own documents
- **DELETE** `/profile/teacher/me/documents/{doc_id}` - Teacher deletes their own document

#### Student Profile (Student-specific profile endpoints)
- **GET** `/profile/student/me` - Student views their own profile
- **PUT** `/profile/student/me` - Student updates their own profile
- **POST** `/profile/student/me/photo` - Student uploads their profile photo
- **POST** `/profile/student/me/signature` - Student uploads their signature
- **POST** `/profile/student/me/documents` - Student uploads a document
- **GET** `/profile/student/me/documents` - Student lists their own documents
- **DELETE** `/profile/student/me/documents/{doc_id}` - Student deletes their own document

#### Attendance (Attendance tracking endpoints)
- **POST** `/attendance` - Teacher marks attendance for a student
- **POST** `/attendance/bulk` - Mark attendance for multiple students at once
- **GET** `/attendance/{id}` - Get full attendance record
- **PUT** `/attendance/{id}` - Update an existing attendance record
- **DELETE** `/attendance/{id}` - Delete an attendance record

#### Dashboard (Analytics and dashboard endpoints)
- **GET** `/dashboard/admin` - Admin dashboard analytics
- **GET** `/dashboard/teacher` - Teacher dashboard analytics
- **GET** `/dashboard/student` - Student dashboard analytics

#### Study Material (Study material management endpoints)
- **POST** `/material` - Upload study material
- **GET** `/material/course/{course_id}` - Get all study materials for a course
- **GET** `/material/me` - Get materials uploaded by current teacher
- **GET** `/material/{material_id}` - Download or view a specific study material file
- **DELETE** `/material/{material_id}` - Delete a study material (author or admin only)

#### AI Reports (AI-generated reports endpoints)
- **POST** `/ai/reports/generate` - Generate Reports
- **GET** `/ai/reports/student/{student_id}` - Get Student Reports
- **GET** `/ai/reports/class/{class_id}` - Get Class Reports
- **GET** `/ai/reports/me` - Get My Reports
- **PUT** `/ai/reports/{report_id}/approve` - Approve Report
- **POST** `/ai/reports/bulk-approve` - Bulk Approve Reports
- **DELETE** `/ai/reports/{report_id}` - Delete Report
- **GET** `/ai/reports/{report_id}/pdf` - Download Report Pdf

#### Teacher Leave (Teacher leave request endpoints)
- **POST** `/teacher/leave` - Submit a new teacher leave request (teacher only)
- **GET** `/teacher/leave` - List all teacher leave requests (admin only)
- **GET** `/teacher/leave/me` - Get my leave requests (teacher or admin)
- **GET** `/teacher/leave/{leave_id}` - Get details of a specific teacher leave request
- **DELETE** `/teacher/leave/{leave_id}` - Delete or withdraw a teacher leave request
- **POST** `/teacher/leave/{leave_id}/review` - Approve or reject a teacher leave request (admin only)

#### AI Admin Analytics (Admin analytics and health report endpoints)
- **GET** `/ai/admin/health/semesters` - List all available semester/year options
- **GET** `/ai/admin/health` - Get institutional health report
- **POST** `/ai/admin/health/generate` - Force-regenerate the institutional health report
- **POST** `/ai/admin/health/chat` - Chat Q&A over the health report
- **GET** `/ai/admin/departments/report` - Department comparison analytics
- **GET** `/ai/admin/departments/report/pdf` - Export department report as PDF
- **GET** `/ai/admin/teachers/activity` - Per-teacher compliance activity with AI flags

#### Health Check (System health check endpoint)
- **GET** `/health` - Health check endpoint


### Installation & Run Guide
#### Docker Compose (Recommended)
1. **Configure Environment**: Copy `.env.example` to `.env` and customize variable values.
2. **Build & Start Services**: Launch containers using:
   ```bash
   docker-compose up --build
   ```
3. **Auto-seeding**: Database schemas will auto-migrate, and initial seeder records will load on startup.
4. **Seed Credentials**:
   - **Role**: `admin`
   - **Username**: `admin`
   - **Password**: `admin123`
#### Local Manual Setup
##### Backend (FastAPI)
1. **Virtual Environment**: Setup and activate Python venv:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run Application**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
##### Frontend (React + Vite)
1. **Install Packages**: Navigate to frontend directory and run npm install:
   ```bash
   cd frontend
   npm install
   ```
2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
