# worktracker-django-react

> A role-based work management system for teams — built with Django REST Framework & React.

WorkTracker Pro helps companies manage projects, assign tasks, track working hours, and review team performance — all within a structured, permission-controlled environment across three roles: **Admin**, **Manager**, and **Employee**.

---

## ✨ Features

### 🔐 Authentication
- JWT-based login with role-aware redirection
- Forgot password via email (SMTP / SendGrid)
- Force password change on first login

### 🛡️ Admin — System Control Center
- **Global Dashboard** — company-wide KPIs (active clients, running jobs, total hours)
- **Client Management** — full CRUD with soft-delete protection (no hard deletes)
- **Job Management** — create and assign jobs to clients and managers
- **Identity & Access Management** — create accounts, assign roles, instant account revocation
- **Audit Logs** — tracks all sensitive actions (who changed what, when)

### 📋 Manager — Orchestration & Review Center
- **Manager Dashboard** — scoped to own team: overdue rate, productivity heatmap
- **Kanban Board** — drag-and-drop task management with `dnd-kit`
- **Task Workflow** — assign → in progress → reviewing → complete (or reject back)
- **Timesheet Review** — view, filter, and lock team timesheets by period
- **Team Directory** — manage team members, view contact info

### 👤 Employee — Execution & Focus Workspace
- **Personal Dashboard** — own KPIs: overdue tasks, weekly hours, completion rate
- **My Tasks** — list/kanban view with drawer-style detail panel (no page navigation)
- **Log Work** — declare hours per task; backend enforces 24h/day cap and lock periods
- **Collaboration** — comment threads with real-time WebSocket notifications
- **Notification Center** — persisted notification history (offline-safe)

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
