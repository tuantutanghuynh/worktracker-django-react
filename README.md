# worktracker-django-react

> A role-based work management system for teams — built with Django REST Framework & React.

WorkTracker Pro helps companies manage projects, assign tasks, track working hours, and review team performance — all within a structured, permission-controlled environment across three roles: **Admin**, **Manager**, and **Employee**.

---

## ✨ Features

### 🌐 Public
- **Login** — JWT-based authentication with secure token storage
- **Forgot Password / Reset Password** — email-based reset flow via SMTP / SendGrid
- **Role-based Redirect** — post-login routing based on assigned role (Admin / Manager / Employee)

### 🛡️ Admin — System Control Center
- **Global Dashboard** — company-wide KPIs: active clients, running jobs, total logged hours
- **Client Management** — full CRUD with soft-delete only (no hard deletes, full history preserved)
- **Job Management** — create and assign jobs to clients and managers
- **Identity & Access Management** — create accounts, assign roles, instant account revocation
- **Audit Logs** — tracks all sensitive actions (who changed what, when)

### 📋 Manager — Orchestration & Review Center
- **Manager Dashboard** — scoped KPIs: overdue rate, productivity heatmap, team summary
- **Team Data Isolation** — managers can only access data belonging to their own team
- **Kanban Board** — drag-and-drop task management powered by `dnd-kit`
- **Task Assignment** — assign tasks to team members with deadline and job context
- **Priority Management** — set and adjust task priority (Low / Medium / High / Urgent)
- **Review / Reject Workflow** — approve submitted tasks or reject them back to in-progress
- **Close Job** — mark a job as closed once all tasks are completed
- **Team Directory** — view and manage team members and their contact info
- **Timesheet Review & Lock** — review team timesheets, filter by period, and lock completed periods

### 👤 Employee — Execution & Focus Workspace
- **Personal Dashboard** — own KPIs: overdue tasks, weekly hours logged, completion rate
- **Quick Log** — fast-access time entry from the dashboard without navigating away
- **My Tasks (List + Kanban + Drawer)** — switch between list and kanban view; open task detail in a slide-over drawer without page navigation
- **Task Status Update** — move tasks through the workflow: to-do → in progress → reviewing
- **Log Work (24h/day validation)** — declare hours per task; backend enforces a 24h/day cap and respects locked periods
- **Collaboration & Comments** — threaded comments on tasks with real-time WebSocket notifications
- **Notification Center** — persisted notification history, safe for offline access
- **User Profile & Avatar** — update personal info and upload a profile avatar

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), TypeScript, Zustand, TanStack Table |
| UI Components | Shadcn UI, Tailwind CSS, Recharts / Tremor |
| Forms & Validation | React Hook Form + Zod |
| Drag & Drop | dnd-kit |
| Real-time | WebSocket via `react-use-websocket` |
| Backend | Django 5, Django REST Framework |
| Auth | `djangorestframework-simplejwt` |
| Real-time Server | Django Channels + Redis |
| Task Queue | Celery + Redis |
| Database | MySQL |
| Audit Logging | `django-simple-history` or custom Middleware |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│          React (Vite)               │
│  Zustand │ TanStack │ Shadcn UI     │
└──────────────────┬──────────────────┘
                   │ REST API / WebSocket
┌──────────────────▼──────────────────┐
│       Django REST Framework         │
│  JWT Auth │ Role Guards │ ORM       │
├─────────────────────────────────────┤
│     Django Channels (WebSocket)     │
│     Celery Workers (Async Tasks)    │
└────────┬──────────────┬─────────────┘
         │              │
      MySQL           Redis
   (Primary DB)   (Pub/Sub + Queue)
```

---

## 🔒 Key Business Rules

- **Soft delete only** — clients and user history are never hard-deleted
- **Data isolation** — managers only see their own team's data
- **State machine for tasks** — status transitions are enforced server-side; employees cannot self-approve
- **Timesheet locking** — locked periods block all edits at the serializer level
- **Instant account revocation** — disabling a user invalidates their JWT immediately

---

## 🚀 Getting Started

> Detailed setup instructions coming soon.

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

---

## 👥 Team

Built as a capstone project — [Aptech Vietnam](https://aptech.edu.vn/)

---

## 📄 License

MIT
