# Student Management System

A production-style backend REST API for managing students, built with FastAPI, PostgreSQL, JWT authentication, and Docker.

---

## Tech Stack

| Category | Technology |
|---|---|
| Backend Framework | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT |
| Containerization | Docker |
| Documentation | Swagger/OpenAPI |
| Validation | Pydantic |
| Password Hashing | Bcrypt |

---

## Features

- User registration and login with JWT authentication
- Protected student CRUD endpoints
- Async API endpoints throughout
- PostgreSQL database with SQLAlchemy ORM
- Dockerized deployment with docker-compose
- Auto-generated Swagger docs at `/docs`

---

## Project Structure

```
student-management-system/
├── app/
│   ├── api/          # Route handlers
│   ├── models/       # SQLAlchemy models
│   ├── schemas/      # Pydantic schemas
│   ├── database/     # DB connection
│   └── auth/         # JWT logic
├── main.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Setup Instructions

### Local Development

**1. Clone the repository**

```bash
git clone https://github.com/nandassk12/student_management_system.git
cd student_management_system
```

**2. Create virtual environment**

```bash
python -m venv venv
venv\Scripts\activate
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Create `.env` file from example**

```bash
cp .env.example .env
```

**5. Update `.env` with your credentials**

```
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/student_db
SECRET_KEY=yoursecretkey
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**6. Run the app**

```bash
uvicorn main:app --reload
```

### Docker Deployment

```bash
docker compose up --build
```

---

## API Endpoints

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Register a new user |
| POST | /auth/login | Login and get JWT token |

### Students

| Method | Endpoint | Description |
|---|---|---|
| POST | /students/ | Create a student |
| GET | /students/ | Get all students |
| GET | /students/{id} | Get student by ID |
| PUT | /students/{id} | Update student |
| DELETE | /students/{id} | Delete student |

---

## Authentication Flow

1. Register via `POST /auth/register`
2. Login via `POST /auth/login` — returns JWT token
3. Add token to all student requests:

```
Authorization: Bearer your_jwt_token
```

---

## Swagger Documentation

Visit `http://localhost:8000/docs` after running the app.

---

## Postman Collection

Import `Student Management System.postman_collection.json` to test all endpoints.
