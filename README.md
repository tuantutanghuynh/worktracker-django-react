# worktracker-django-react

> A role-based work management system for teams — built with Django REST Framework & React.

WorkTracker Pro helps companies manage projects, assign tasks, track working hours, and review team performance — all within a structured, permission-controlled environment across three roles: **Admin**, **Manager**, and **Employee**.

---

## ✨ Features

### 🌐 Public & Core Auth
- **JWT Authentication** — Access & Refresh Token authentication via `rest_framework_simplejwt`
- **Immediate Account Revocation** — `CachedIsActiveJWTAuthentication` validates user status against Redis on every request for instant token invalidation upon account locking
- **Forgot / Reset Password** — Secure email-based reset flow via SMTP / SendGrid
- **Role-Based Redirect** — Post-login routing based on assigned role (Admin / Manager / Employee)
- **API Documentation** — Auto-generated Swagger UI / OpenAPI 3.0 documentation via `drf-spectacular` at `/api/docs/`

### 🛡️ Admin — System Control Center
- **Global Dashboard** — Company-wide KPIs: active clients, running jobs, total logged hours
- **Client Management** — Full CRUD with soft-delete only (`is_active=False`, full history preserved)
- **Job Management** — Create and assign jobs to clients and managers
- **Identity & Access Management** — Create user accounts, assign roles, and revoke access instantly
- **Audit Trail** — System-wide logging tracking all sensitive actions (who changed what, when)

### 📋 Manager — Orchestration & Review Center
- **Manager Dashboard & Heatmap** — Scoped KPIs: overdue rate, task completion rate, and productivity heatmap of logged work hours
- **Team Data Isolation** — Strict row-level scoping (`scoped_jobs`, `scoped_tasks`, `scoped_logworks`) ensuring managers only access data belonging to their assigned jobs (`jobs.manager_id`)
- **Kanban Board with Lexicographical Reordering** — Drag-and-drop task management powered by base-62 **Lexicographical String Indexing** (`order_index_manager_service.py`) for sub-millisecond task reordering without bulk DB updates
- **Task Management & Followers** — Create, assign tasks to team members with deadline, job context, priority settings (Low / Medium / High / Urgent), and assign multiple task followers
- **Media & File Attachments** — Physical media upload with a 20MB limit, file format filtering, UUID filename storage to prevent directory traversal, and automatic disk rollback if DB saving fails
- **Review / Reject Workflow** — Approve submitted tasks (`IN_REVIEW` → `COMPLETED`) or reject them with mandatory rejection reason back to `IN_PROGRESS`
- **Timesheet Review & Post-Audit Workflow** — Review team timesheets, approve (`APPROVED`), reject (`REJECTED`), correct/adjust logged hours (`CORRECTED`), or void invalid logs (`VOIDED`) preserving immutable audit history
- **Timesheet Locking (Time Lock)** — Lock/unlock monthly timesheet periods by Job scope (`JOB`), preventing any timesheet modifications once locked
- **Team Directory & Department Management** — View project personnel and assign/update employee departments directly
- **Audit Logs Querying** — Query, filter, and inspect manager's own audit log history with old/new value snapshots (`old_values`, `new_values`)
- **Multi-Channel Real-time & Async Notifications** — Persisted notification center, background async email dispatch via Celery workers with 3x retry mechanism, and instant real-time WebSocket pushes via Django Channels (`ws/notifications/`)
- **Report Export (Excel & PDF)** — Export Task Summary and Timesheet Detail reports formatted as `.xlsx` (via `openpyxl`) or `.pdf` (via `xhtml2pdf`)

### 👤 Employee — Execution & Focus Workspace
- **Personal Dashboard** — Own KPIs: overdue tasks, weekly hours logged, completion rate
- **Quick Log** — Fast-access time entry directly from the dashboard
- **My Tasks (List + Kanban + Drawer)** — Switch between list and kanban view; open task detail in a slide-over drawer
- **Task Status Update** — Move tasks through the workflow: `TODO` → `IN_PROGRESS` → `IN_REVIEW` (State machine blocks self-approval)
- **Log Work (24h/day validation)** — Declare hours per task; backend enforces a 24h/day cap per user and respects locked periods
- **Collaboration & Comments** — Threaded comments on tasks with real-time WebSocket notifications
- **Notification Center** — Persisted notification history, safe for offline access
- **User Profile & Avatar** — Update personal info and upload profile avatar

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), TypeScript, Zustand, TanStack Table |
| UI Components | Shadcn UI, Tailwind CSS, Recharts / Tremor |
| Forms & Validation | React Hook Form + Zod |
| Drag & Drop | dnd-kit |
| Real-time Client | WebSockets via `react-use-websocket` |
| Backend | Django 6.0.6, Django REST Framework 3.17.1 |
| Auth & Security | `djangorestframework-simplejwt` + Redis Cached Is Active Check |
| Real-time Server | Django Channels 4.2 + Daphne (ASGI) + Redis Channel Layer |
| Task Queue | Celery 5.5 + Redis Broker + `django-celery-results` (PostgreSQL) |
| Database | **PostgreSQL** (`worktracker_db`) |
| API Docs | `drf-spectacular` (OpenAPI 3.0 / Swagger UI at `/api/docs/`) |
| Report Export | `openpyxl` (Excel `.xlsx`), `xhtml2pdf` (PDF `.pdf`) |
| Audit Logging | `django-simple-history` + Custom Audit Snapshot Service |
| Automated Testing | Pytest 8.3 + `pytest-django` + `pytest-cov` (109 passing tests, 84% coverage) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React (Vite)                         │
│    Zustand │ TanStack Table │ Shadcn UI │ dnd-kit       │
└────────────────────────────┬────────────────────────────┘
                             │ REST API / WebSocket
┌────────────────────────────▼────────────────────────────┐
│              Django REST Framework / Daphne             │
│   JWT Auth │ 3-Layer RBAC │ Scope Guards │ Swagger      │
├─────────────────────────────────────────────────────────┤
│        Django Channels Layer (WebSocket / Redis)        │
│        Celery Workers (Async Email Task Queue)          │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
           PostgreSQL                   Redis
     (Primary DB: worktracker_db)   (DB1: Cache, DB2: Celery, DB4: Channels)
```

---

## 🔒 Key Business Rules

- **Soft Delete Only** — Clients and users are never hard-deleted (`is_active=False` preserves complete history)
- **Immutable LogWork History** — LogWork entries are never hard-deleted; invalid entries are marked as `VOIDED`
- **Data Scoping & Isolation** — Managers can only view and manipulate data belonging to their assigned jobs (`jobs.manager_id`)
- **3-Layer Security Guard** — Requests must pass `IsActiveAuthenticated`, `IsManagerRole`, and granular `HasPermissionCode`
- **Instant Account Revocation** — Account status changes are cached in Redis and evaluated on every request to invalidate active JWTs instantly
- **Lexicographical Ordering** — LexoRank string keys allow instant Kanban drag-and-drop reordering without bulk database updates
- **Timesheet Locking** — Monthly job-scoped locks (`JOB`) prevent any LogWork modifications once period is locked
- **Daily Hours Cap** — Backend strictly enforces a maximum limit of 24.00 logged hours per user per day

---

## 🚀 Getting Started

```bash
# 1. Backend Setup
cd backend

# Create & activate virtual environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed initial Manager permissions
python manage.py shell -c "import seed_manager_permissions"

# Run development server
python manage.py runserver

# 2. Automated Tests (Pytest)
.\venv\Scripts\pytest testcase/

# 3. Frontend Setup
cd ../frontend
npm install
npm run dev
```

---

## 🧪 Testing & Quality Assurance

The backend includes a comprehensive automated test suite built with **Pytest**:

- **109 Automated Tests** passing 100% (`109/109 passed`)
- **84% Overall Code Coverage**
- **100% Coverage** on Manager Filter & Query Parameter classes (`ManagerJobFilter`, `ManagerTaskFilter`, `ManagerLogWorkFilter`, `ManagerTimeLockFilter`)

---

## 👥 Team

Built as a capstone project — [Aptech Vietnam](https://aptech.edu.vn/)

---

## 📄 License

MIT
