# College Student Management System

A production-ready backend API for managing college students,
built with FastAPI, PostgreSQL, JWT authentication, and Docker.

Built as Phase 2 of an internship project — upgraded from a basic
CRUD system to a full college portal with the following modules:

- Role-based access control (Admin, Teacher, Student)
- Authentication & JWT security
- Department, Course & Class management
- Student profiles & enrollment
- Attendance tracking & predictor
- Grades & GPA calculator
- Fee management
- Leave request system
- Notice board
- Study material uploads
- Dashboard per role
- Rate limiting & request logging
- In-memory caching

---

## 🚀 Tech Stack

- **Framework**: FastAPI (Async ASGI)
- **Database**: PostgreSQL (Asynchronous Connection Pool via `asyncpg`)
- **ORM**: SQLAlchemy 2.0 (Modern Type-Safe Declarative Mapped Columns)
- **Migrations**: Alembic
- **Caching**: `fastapi-cache2` (InMemoryBackend)
- **Rate Limiting**: `slowapi` (IP-based token bucket limiter)
- **Authentication**: JWT (JSON Web Tokens) with cryptographically hashed passwords (`bcrypt`)
- **Containerization**: Docker & Docker Compose
- **Environment**: Pydantic-settings loaded from `.env`

---

## 🛠️ Features by Sprint

### Sprint 1: Core Foundation & Academic Setup
- **Authentication**: JWT token login (`POST /auth/login`) and active session information (`GET /auth/me`).
- **Users**: Admin-managed user records with roles (`admin`, `teacher`, `student`) and soft-delete capabilities.
- **Departments & Courses**: Academic department details and courses.
- **Classes**: Batch representations (e.g. "AIML 2023") linked to departments.
- **Profiles & Enrollment**: Student enrollment status, class linking, and profiles.

### Sprint 2: Academic Tracking & Timetabling
- **Attendance**: Daily attendance tracking (present, absent, late) with class/student statistics.
- **Grades**: Semester-based grades (A, B, C, D, F) with automated GPA tracking.
- **Timetables**: Weekly schedules with interval-overlap clash detection.

### Sprint 3: Management & Administrative Modules
- **Fees**: Student financial obligations (tuition, hostel, exam, library) with status tracking (paid, pending, overdue).
- **Leave Requests**: Student-initiated leave requests with review/approval workflows for teachers.
- **Notice Board**: Announcements targeting specific roles (all, student, teacher) or classes.

### Sprint 4: Resources Module & Advanced Analytics
- **Study Materials**: Multipart form file upload of PDFs, DOCX, MP4 videos, and images with disk storage and DB referencing.
- **Attendance Predictor**: Predicts how many consecutive attendances are needed to reach a target of $75\%$ using $X = \max(0, 3T - 4A)$.
- **GPA What-If Simulator**: Predicts hypothetical GPA changes based on expected course marks.

### Sprint 5: Performance, Polish & Dashboards
- **Logging Middleware**: Request logger routing all methods, paths, status codes, and latencies to console and `logs/app.log`.
- **Rate Limiter**: Strict IP-based limit of $100$ requests per minute returning standard HTTP $429$ on overflow.
- **Caching**: In-memory caching on list endpoints to reduce database queries.
- **Dashboards**: Consolidated analytics for Admins, Teachers, and Students.

---

## 📁 Caching Rules

The application uses an in-memory cache backend to reduce latency on relatively static GET endpoints. Expiry configurations (TTL):
- **Timetable (`/timetable/class/{id}`, `/timetable/me`)**: `3600 seconds` (1 hour)
- **Notice Board (`/notice`)**: `1800 seconds` (30 minutes)
- **Departments & Courses (`/departments`, `/courses`)**: `7200 seconds` (2 hours)

---

## 🔒 Rate Limiting & Logging

- **Rate Limit**: Maximum `100 requests per minute` per client IP. Excess requests receive a `429 Too Many Requests` status code with a JSON detail payload.
- **Request Logging**: Structured ASGI request intercept log outputs:
  `2026-05-26 16:40:00 [INFO] Method: GET | Path: /dashboard/admin | Status: 200 | Time: 0.0240s`
  Logs are written to both standard output and a rolling file at `logs/app.log`.

---

## 📦 Running the Application (Docker Compose)

### Prerequisite
Ensure Docker and Docker Compose are installed on your system.

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

### 2. Launch Services
Run the following command to build the Docker image and start the PostgreSQL database and FastAPI backend:
```bash
docker-compose up --build
```
The application database tables will be auto-created on startup, and an idempotent database seeder will run.

### 3. Default Seed Credentials
- **Role**: `admin`
- **Username**: `admin`
- **Password**: `admin123`

---

## 📊 Dashboard Metrics

### Admin Dashboard (`GET /dashboard/admin`)
- Total active students and teachers counts
- Total fees collected (paid) and pending fees sums
- Pending student leave requests count
- Total study materials count

### Teacher Dashboard (`GET /dashboard/teacher`)
- Assigned classes count (unique classes from timetable slots)
- Pending leave requests assigned to the teacher
- Today's attendance records marked by the teacher
- Total study materials uploaded by the teacher

### Student Dashboard (`GET /dashboard/student`)
- Attendance percentage per course (present/late counts as present)
- Pending/overdue fees total
- Current GPA (4.0 scale)
- Today's timetable slots sorted by start time
