---
name: check_worktracker
description: Use when validating cross-role business logic, real-world domain constraints, and end-to-end user workflows across Admin, Manager, and Employee portals in WorkTracker.
---

# check_worktracker: Business-First Verification Standard

## Overview
This skill defines the mandatory protocol for verifying the **WorkTracker** application (both Backend and Frontend). Verification must go beyond mere code compilation, HTTP 200 responses, or basic unit test passes. It requires validating **real-world business logic reasonableness, domain invariants, temporal hierarchy, and cross-role synchronization** across the three primary actor portals: **Admin**, **Manager**, and **Employee**.

---

## 1. Core Verification Philosophy

When evaluating any feature, bugfix, or refactor in WorkTracker, apply the following ground rules:

1. **Business Reasonability Over Syntactic Correctness**: A feature is not verified simply because the code executes without exceptions. It is only verified when the outcome aligns with realistic organizational workflows, accounting rules, and project management standards.
2. **Cross-Role Domain Cohesion**: Changes made by one role (e.g., Admin creating a Job) must correctly constrain and reflect in downstream roles (Manager breaking down Tasks, Employee logging work).
3. **Temporal Integrity**: Dates and times must maintain strict chronological hierarchy across all entities (Clients $\rightarrow$ Jobs $\rightarrow$ Tasks $\rightarrow$ Timesheets).
4. **Audit Trail & Terminal State Immutability**: Historical financial or completed execution records must never be silently mutated or retroactively altered without explicit audit logging.

---

## 2. The Three Role Pillars & Inspection Checkpoints

```
  +-------------------------------------------------------------------------+
  |                          ADMIN (Global Governance)                      |
  |  - Client Lifecycle (Active / Deactivated Freezing)                     |
  |  - Departments & User Hierarchy                                         |
  |  - Master Job Boundary [start_date, deadline] & Manager Assignment      |
  |  - Global TimeLocks & Accounting Period Closures                        |
  |  - 1-on-1 Support Desk & Global Audit Trail                             |
  +-----------------------------------+-------------------------------------+
                                      |
                                      v
  +-------------------------------------------------------------------------+
  |                   MANAGER (Scoping & Quality Assurance)                 |
  |  - Task Breakdown strictly bounded by Parent Job Timeline               |
  |  - Team Member Allocation (Within Department Scope)                     |
  |  - Task Edit Rules by Lifecycle:                                        |
  |      * TODO: Full edits allowed (start_date, deadline, assignee, etc.)  |
  |      * IN_PROGRESS / REVIEWING: Deadline editable; start_date LOCKED    |
  |      * COMPLETED / CANCELLED: Entirely LOCKED (Read-only audit record)  |
  |  - QA Review Queue (Approve -> COMPLETED vs Reject -> Rework with Notes)|
  |  - Timesheet Approvals & Voiding (Reason mandatory; TimeLock enforced)  |
  |  - Gantt & Kanban Timeline Synchronization                              |
  +-----------------------------------+-------------------------------------+
                                      |
                                      v
  +-------------------------------------------------------------------------+
  |                    EMPLOYEE (Execution & Self-Reporting)                |
  |  - Task Intake (Active vs Frozen segregation)                           |
  |  - Sequential Status Progression: TODO -> IN_PROGRESS -> REVIEWING      |
  |  - Recall Mechanism (Recall from REVIEWING to IN_PROGRESS before review)|
  |  - Deliverables Submission & Attachment Verification                    |
  |  - Daily Work Logging (Timesheets):                                     |
  |      * Maximum 8.0 hours/day per employee across all tasks              |
  |      * No future date logging                                           |
  |      * Strictly blocked on TODO, COMPLETED, or CANCELLED tasks          |
  |      * Strictly blocked if date falls into a Locked Period              |
  |  - Support Inquiries & Personal KPI Performance                         |
  +-------------------------------------------------------------------------+
```

---

### Pillar 1: Admin Branch (Global Governance)

Inspect the following business checkpoints on the Admin portal:

* **Client Lifecycle & Freezing Cascade**:
  * Active Clients permit normal job creation and task execution.
  * Deactivating a Client must immediately **freeze** all associated Jobs and open Tasks, preventing new work logs or status progressions until reactivated.
* **User & Department Hierarchy**:
  * Role assignment (`ADMIN`, `MANAGER`, `EMPLOYEE`) must enforce strict route guards and API permission classes.
  * Deactivating a user must revoke authentication sessions, unassign them from future task allocations, and retain past audit history.
* **Master Job Governance**:
  * Every Job must define a mandatory `client`, `manager`, `start_date`, and `deadline`.
  * `job.start_date` must precede or equal `job.deadline`.
* **TimeLocks (Global & Job Level)**:
  * Locking a fiscal period (e.g., closing a past month) must globally disallow any creation, editing, or voiding of timesheet logs within that date range.
* **Support Desk (1-on-1 Routing)**:
  * Admin Support Desk must strictly isolate individual user inquiry channels from multi-user job collaboration chat channels.
  * Notification badges on the sidebar must accurately track unresolved 1-on-1 support tickets without being polluted by general job channel unread counts.

---

### Pillar 2: Manager Branch (Scoping, Allocation & Quality Assurance)

Inspect the following business checkpoints on the Manager portal:

* **Task Timeline Scoping**:
  * Tasks created under a Job must satisfy: $\text{job.start\_date} \le \text{task.start\_date} \le \text{task.deadline} \le \text{job.deadline}$.
  * The system must reject task dates outside the parent job bounds with clear descriptive error messages.
* **Status-Based Task Modification Matrix**:
  | Task Status | `start_date` Editable? | `deadline` Editable? | Assignee / Scope Editable? | Business Rationale |
  | :--- | :---: | :---: | :---: | :--- |
  | **TODO** | **YES** | **YES** | **YES** | Task has not started; plans and resources can be freely scheduled. |
  | **IN_PROGRESS** | ⛔ **NO** (Locked) | **YES** (Extension) | Limited | Work is underway and past hours may be logged. Shifting `start_date` into the future contradicts existing log history. |
  | **REVIEWING** | ⛔ **NO** (Locked) | **YES** (Extension) | ⛔ **NO** | Work submitted for QA. Execution start is historical fact. |
  | **COMPLETED** | ⛔ **NO** (Locked) | ⛔ **NO** (Locked) | ⛔ **NO** (Locked) | Terminal state. Serves as immutable audit record for KPI and billing. |
  | **CANCELLED** | ⛔ **NO** (Locked) | ⛔ **NO** (Locked) | ⛔ **NO** (Locked) | Closed state; cannot be altered. |
* **Quality Assurance (Review Queue)**:
  * When an Employee submits deliverables (`REVIEWING`), Manager can:
    1. **Approve**: Sets status to `COMPLETED`, stamps `completed_at`, recalculates parent Job progress percentage.
    2. **Reject**: Requires a mandatory **Rejection Reason Note**, transitions task back to `IN_PROGRESS`, flags it for Employee rework, and notifies the assignee.
* **Timesheet Reviews & Voiding**:
  * Manager reviews daily work logs for assigned projects.
  * Voiding a timesheet entry requires a documented reason and must check that the entry date is not within a locked TimeLock period.
* **Gantt & Kanban Synchronization**:
  * Gantt charts must map task timeline bars strictly using `start_date` as the left boundary and `deadline` as the right boundary (never falling back blindly to `created_at` when `start_date` is defined).

---

### Pillar 3: Employee Branch (Execution, Deliverables & Self-Reporting)

Inspect the following business checkpoints on the Employee portal:

* **Task Intake & Execution Lifecycle**:
  * Progression order is strictly sequential: `TODO` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `REVIEWING`.
  * Employees **cannot** jump directly from `TODO` to `COMPLETED` or manually set `COMPLETED` / `CANCELLED`. Only Managers have QA sign-off authority.
  * Starting a task (`IN_PROGRESS`) stamps `started_at`.
* **Recall Capability**:
  * If an Employee accidentally submits a task to `REVIEWING`, they may invoke **Recall** to return the task to `IN_PROGRESS` as long as the Manager has not yet accepted or reviewed it.
* **Deliverable Submission**:
  * If a Task is configured with required deliverables, transitioning to `REVIEWING` requires uploading valid file attachments or proof links.
* **Timesheet Work Logging Invariants**:
  * **Daily Limit**: An employee cannot log more than **8.0 hours per calendar day** across all combined tasks.
  * **No Future Logging**: `work_date` cannot be in the future ($\text{work\_date} \le \text{today}$).
  * **Status Constraint**: Work can only be logged on tasks in `IN_PROGRESS` or `REVIEWING` state. Attempting to log on `TODO`, `COMPLETED`, or `CANCELLED` tasks must be rejected.
  * **TimeLock Constraint**: Cannot log work on dates covered by an active TimeLock.
  * **Adjustment Notes**: Editing a logged entry requires an explanatory note for the manager's audit view.

---

## 3. Fundamental Business Invariants (Ground Truth Rules)

The verification process must confirm that the system enforces the following non-negotiable invariants at all times:

```
[Invariant 1: Temporal Hierarchy]
  Job.start_date <= Task.start_date <= Task.deadline <= Job.deadline

[Invariant 2: Scope & Role Authority]
  - Manager scope is restricted to assigned department / jobs.
  - Employee cannot bypass Manager QA to complete tasks.

[Invariant 3: Terminal Immutability]
  - Tasks in COMPLETED or CANCELLED status are 100% read-only.
  - No date shifts, no assignee changes, no new work logs.

[Invariant 4: Daily LogWork Upper Bound]
  - SUM(hours_spent) for User U on Date D across all tasks <= 8.0 hours.

[Invariant 5: TimeLock Supremacy]
  - If Date D is within [TimeLock.start_date, TimeLock.end_date]:
    Creation, modification, or voiding of timesheets on Date D is FORBIDDEN.

[Invariant 6: Deactivation Cascading]
  - Deactivated Client -> Associated Jobs and Tasks automatically frozen.
  - Inactive User -> All active session tokens revoked, task intake disabled.
```

---

## 4. Multi-Tier Verification Protocol

Verify features across all four architectural tiers to ensure end-to-end integrity:

### Tier 1: Database & Model Layer
* Ensure proper constraints, ForeignKeys (`on_delete=models.PROTECT` or `CASCADE` where appropriate), indexes, and default status enumerations.
* Verify date fields (`start_date`, `deadline`, `started_at`, `completed_at`) maintain timezone awareness and appropriate nullability.

### Tier 2: Domain Services & Business Rules
* Validate that core logic resides in domain services (e.g., `TaskService`, `LogWorkService`, `TimeLockService`), not scattered inside views or controllers.
* Verify transaction boundaries (`transaction.atomic`) when executing multi-step updates (e.g., approving a task, recording completion timestamp, recalculating job progress, sending notifications).

### Tier 3: API Contracts & Serializer Validations
* Verify request serializers return clear `400 Bad Request` with structured error messages (e.g., `{"deadline": ["Task deadline cannot exceed parent job deadline."]}`).
* Verify unauthorized role actions return `403 Forbidden` rather than generic `500 Internal Server Error`.

### Tier 4: Frontend UI/UX Guardrails
* **Action State**: Disabled buttons or hidden action menus for unauthorized states (e.g., "Edit Task" button hidden when task is `COMPLETED`).
* **Visual Feedback**: Informative tooltips on disabled elements explaining *why* the action is locked (e.g., "Start date cannot be modified while task is in progress").
* **Error Notifications**: Meaningful toast error alerts mapping API validation errors to user-friendly messages.
* **Layout Consistency**: Ensure unified components (e.g., Profile layouts, Status Badges, Date Pickers) provide a consistent user experience across Admin, Manager, and Employee portals.

---

## 5. Real-World End-to-End Scenario Matrix

When testing, execute these 5 real-world scenarios to validate cross-role behavior:

### Scenario 1: Standard End-to-End Project & Task Lifecycle
```
Step 1 [Admin]: Creates Client "Acme Corp" and Master Job "Website Redesign" (2026-09-01 to 2026-09-30), assigns Manager M.
Step 2 [Manager M]: Creates Task "Implement Authentication" (start: 2026-09-05, deadline: 2026-09-15), assigns Employee E.
Step 3 [Employee E]: Sees Task in TODO -> clicks "Start Task" -> Status becomes IN_PROGRESS.
Step 4 [Employee E]: Logs 4.0 hours on 2026-09-06 with description "Setup JWT endpoints".
Step 5 [Employee E]: Attaches deliverable PR link -> clicks "Submit for Review" -> Status becomes REVIEWING.
Step 6 [Manager M]: Opens Review Queue -> inspects deliverable -> clicks "Approve".
Outcome: Task status is COMPLETED; completed_at is stamped; Job progress increases; Task edit form is completely locked.
```

### Scenario 2: Boundary Violation & Unauthorized Mutation Attempts (Negative Testing)
```
Step 1 [Manager]: Attempts to create Task with deadline "2026-10-05" on a Job ending "2026-09-30".
      Expected Result: 400 Bad Request ("Task deadline cannot exceed parent Job deadline").
Step 2 [Manager]: Attempts to move start_date of an IN_PROGRESS task from "2026-09-05" to "2026-09-12" when work was already logged on "2026-09-06".
      Expected Result: UI disables start_date field; Backend rejects modification.
Step 3 [Employee]: Attempts to submit a direct API request to set task status to COMPLETED.
      Expected Result: 403 Forbidden / Validation Error (Only Managers can approve completion).
```

### Scenario 3: QA Rejection & Deliverable Rework Cycle
```
Step 1 [Employee E]: Submits Task "Frontend Dashboard" for review (REVIEWING).
Step 2 [Manager M]: Finds missing unit tests -> enters rejection reason "Please add Jest unit tests for widget rendering" -> clicks "Reject".
Outcome: Task transitions back to IN_PROGRESS; Employee E receives notification with reason; Task displays "Rework Required" badge.
Step 3 [Employee E]: Adds tests -> resubmits to REVIEWING.
Step 4 [Manager M]: Approves task -> Task becomes COMPLETED.
```

### Scenario 4: Daily Timesheet Logging, Over-Limit Protection & TimeLocking
```
Step 1 [Employee E]: Logs 5.0 hours on Task A for date 2026-09-08. (Accepted: Total = 5.0h)
Step 2 [Employee E]: Attempts to log 4.0 hours on Task B for the same date 2026-09-08.
      Expected Result: Rejection (5.0h + 4.0h = 9.0h > 8.0h daily limit).
Step 3 [Employee E]: Adjusts log to 3.0 hours. (Accepted: Total = 8.0h).
Step 4 [Admin]: Activates TimeLock for period 2026-09-01 to 2026-09-10.
Step 5 [Employee E / Manager M]: Attempts to edit or void the 3.0h log on 2026-09-08.
      Expected Result: 400/403 Error ("This date is locked by an active TimeLock accounting period").
```

### Scenario 5: Emergency Client Deactivation & Task Freezing
```
Step 1 [Admin]: Deactivates Client "Acme Corp" due to contract pause.
Outcome: All associated Jobs and Tasks are marked Frozen.
Step 2 [Employee E]: Attempts to log work or advance task status on "Acme Corp" tasks.
      Expected Result: Action blocked with message ("Project is currently frozen due to inactive client").
Step 3 [Admin]: Reactivates Client "Acme Corp".
Outcome: Workflows resume seamlessly without data corruption.
```

---

## 6. Actionable Verification Runbook

Before certifying any change in WorkTracker as complete, execute this runbook:

1. **Automated Backend Regression Suite**:
   ```bash
   pytest
   ```
   *Ensure all unit and integration tests pass (100% green).*

2. **Automated Frontend Build & Type Check**:
   ```bash
   npm run build
   ```
   *Ensure zero syntax, bundle, or TypeScript/JSX compile errors.*

3. **Cross-Role Invariant Inspection**:
   * Verify date hierarchy holds true across all affected endpoints.
   * Verify permissions prevent unauthorized role elevation or cross-tenant data leakage.
   * Verify UI controls correctly display disabled/read-only states for terminal tasks.
