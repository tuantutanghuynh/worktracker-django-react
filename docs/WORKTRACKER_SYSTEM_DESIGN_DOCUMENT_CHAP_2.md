# CHAPTER 2: SOFTWARE REQUIREMENTS SPECIFICATION

### 2.1 Purpose

The purpose of this Software Requirements Specification is to define the system requirements for the WorkTracker web-based application.

This chapter describes the expected behavior, user roles, functional scope, non-functional scope, business rules, assumptions, and constraints of the WorkTracker system. It provides a formal reference for system analysis, system design, database design, API design, user interface design, testing, deployment, and future maintenance.

The requirements in this chapter are intended to ensure that the system supports centralized work management, task coordination, timesheet tracking, notification delivery, reporting, and audit logging in a structured and traceable manner.

This SRS chapter is prepared for the following audiences:

  --------------------------------------------------------------------------------------------------------------------------------
  Audience                            Purpose
  ----------------------------------- --------------------------------------------------------------------------------------------
  Instructor / Supervisor             To evaluate whether the system scope and requirements are clear, complete, and consistent.

  Developer                           To understand what functions and rules must be implemented.

  Tester                              To design test cases based on defined requirements and business rules.

  Project Evaluator                   To verify whether the final system satisfies the stated requirements.

  Future Maintainer                   To understand the original requirement baseline before modifying or extending the system.
  --------------------------------------------------------------------------------------------------------------------------------

This chapter focuses on the requirement specification of the WorkTracker system. Detailed functional requirements and non-functional requirements are maintained separately in the appendices to avoid making the main chapter unnecessarily long.

### 2.2 Overall Description

WorkTracker is a web-based work management and time tracking system designed for internal business operations. The system supports organizations in managing users, roles, permissions, clients, jobs, tasks, timesheets, notifications, reports, profiles, and audit logs.

The system is designed around three main user roles:

-   Admin
-   Manager
-   Employee

Each role has a different responsibility and access scope within the system.

Admin is responsible for managing system-level data and configuration. Manager is responsible for coordinating jobs, assigning tasks, reviewing task results, monitoring team performance, and managing timesheet periods. Employee is responsible for performing assigned tasks, updating progress, logging work hours, participating in task discussions, and maintaining personal profile information.

The system follows a Client-Server architecture. The frontend provides the user interface and user interaction layer. The backend provides authentication, authorization, business logic, validation, database access, reporting, notification processing, and audit logging. The database stores structured business data such as users, clients, jobs, tasks, timesheets, notifications, and audit logs.

The system supports the following major modules:

  ----------------------------------------------------------------------------------------------------------------------------------------
  Module                              Description
  ----------------------------------- ----------------------------------------------------------------------------------------------------
  Authentication and Authorization    Handles login, logout, password reset, JWT authentication, role checking, and permission checking.

  User and Role Management            Allows Admin to manage user accounts, roles, permissions, and access control.

  Client Management                   Allows Admin to manage client or partner information.

  Job Management                      Allows authorized users to manage master jobs linked to clients and managers.

  Task and Kanban Management          Allows Manager to create, assign, organize, review, and track tasks using a Kanban workflow.

  Timesheet Management                Allows Employee to log work hours and allows authorized users to review timesheet data.

  Time Lock Management                Allows authorized users to lock or unlock timesheet periods to prevent further modification.

  Notification Management             Sends and stores realtime or email-based notifications for important system events.

  Profile Management                  Allows users to view and update personal profile information.

  Reporting and Export                Provides dashboard statistics and report export functions for Admin and Manager.

  Audit Logging                       Records sensitive actions for traceability, accountability, and system supervision.
  ----------------------------------------------------------------------------------------------------------------------------------------

The system is not intended to provide full accounting, payroll processing, financial management, or advanced human resource management. It focuses on work management, task tracking, timesheet control, and performance monitoring.

## 2.3 User Roles and Responsibilities

The WorkTracker system defines three primary user roles: Admin, Manager, and Employee. Each role has a specific purpose, access scope, and responsibility.

### 2.3.1 Admin

Admin is the highest-level user in the system. Admin is responsible for system administration, configuration, supervision, and global data control.

Admin responsibilities include:

  --------------------------------------------------------------------------------------------------------------------------------------------------
  Responsibility                      Description
  ----------------------------------- --------------------------------------------------------------------------------------------------------------
  Manage user accounts                Create, update, lock, unlock, or deactivate user accounts.

  Manage roles and permissions        Configure roles and assign permissions according to the RBAC model.

  Manage departments                  Create and update department or team information.

  Manage clients                      Create, update, view, and deactivate client records.

  Manage master jobs                  Create and manage job records linked to clients and managers.

  Monitor global dashboard            View company-level metrics such as active clients, running jobs, total work hours, and task status overview.

  View audit logs                     Review sensitive system activities for monitoring and traceability.

  Export reports                      Export reports based on authorized global system data.

  Control account status              Lock or deactivate accounts when users leave or lose access permission.
  --------------------------------------------------------------------------------------------------------------------------------------------------

Admin users have broad access to system-level data. However, Admin actions must still be controlled by authentication, authorization, and audit logging.

### 2.3.2 Manager

Manager is responsible for coordinating jobs, tasks, employees, and timesheets within the authorized management scope.

Manager responsibilities include:

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Responsibility                          Description
  --------------------------------------- -----------------------------------------------------------------------------------------------------------------------------------
  Manage assigned jobs                    View and manage jobs under the Manager's responsibility.

  Create tasks                            Break down jobs into smaller tasks.

  Assign tasks                            Assign tasks to employees.

  Set priority and deadline               Define task priority, deadline, and workflow status.

  Manage Kanban board                     Track task progress through Kanban columns.

  Review task completion                  Approve or reject tasks submitted for review.

  Manage task discussion                  Participate in comments and task-related communication.

  View employee timesheets       Review work hours logged by employees assigned to tasks under the Manager\'s jobs (jobs.manager_id).

  Lock timesheet period                   Lock timesheet data after review or reporting period closure, if authorized.

  Export reports                          Generate and export reports within the authorized scope.

  Monitor employee performance   View performance metrics, overdue tasks, workload, and timesheet summaries for employees working on the Manager\'s jobs.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Manager access must be scope-limited. A Manager must not be able to view or modify jobs, tasks, employees, timesheets, or reports outside the authorized management scope.

### 2.3.3 Employee

Employee is the user who directly performs assigned work.

Employee responsibilities include:

  ----------------------------------------------------------------------------------------------------------
  Responsibility                      Description
  ----------------------------------- ----------------------------------------------------------------------
  View assigned tasks                 View personal task list and task details.

  Update task progress                Change task progress according to permitted workflow transitions.

  Submit task for review              Move completed work to the review state for Manager approval.

  Add comments                        Participate in task discussion and report work progress.

  Upload attachments                  Upload related task files when required.

  Log work hours                      Record the number of hours spent on assigned tasks.

  View personal dashboard             View personal task status, logged hours, and performance indicators.

  Receive notifications               Receive task, comment, review, and system notifications.

  Manage profile                      View and update permitted personal profile information.
  ----------------------------------------------------------------------------------------------------------

Employee access must be limited to personal data and authorized task-related data. An Employee must not be able to access another employee's private task or timesheet data unless explicitly permitted.

### 2.3.4 System Services

In addition to human users, the system interacts with supporting services.

  -------------------------------------------------------------------------------------------------------------------------------
  Service                             Responsibility
  ----------------------------------- -------------------------------------------------------------------------------------------
  Email Service                       Sends password reset emails and notification emails.

  File Storage Service                Stores avatar images and task attachment files.

  Realtime Gateway                    Delivers realtime notification payloads to online users through WebSocket.

  Redis                               Supports caching, realtime communication, token handling, and background task processing.

  PostgreSQL Database                 Stores structured business data and enforces relational integrity.
  -------------------------------------------------------------------------------------------------------------------------------

## 2.4 Functional Requirements

# 1. Overview

The WorkTracker system shall provide a centralized platform for managing internal work processes, including user authentication, role-based access control, client management, job management, task assignment, Kanban-based task tracking, timesheet logging, time locking, notification delivery, reporting, profile management, and audit logging.

The system shall support three main user roles:

-   Admin: responsible for system administration, user management, access control, client management, master job management, global reporting, and audit monitoring.

-   Manager: responsible for managing jobs assigned to them (jobs.manager_id), creating and assigning tasks under those jobs, reviewing task completion, monitoring team performance for employees working on those jobs, reviewing timesheets, locking timesheet periods, and exporting reports within their job-based scope.

-   Employee: responsible for viewing assigned tasks, updating task progress, submitting tasks for review, writing comments, uploading attachments, logging work hours, viewing personal KPIs, and maintaining personal profile information.

The system shall also interact with external infrastructure services, including Email Service, File Storage Service, and Realtime Gateway.

# 2. Authentication and Authorization Requirements

## FR-01: User Login

The system shall allow Admin, Manager, and Employee users to log in using a registered email and password.

The system shall validate the submitted credentials against the users table. If the credentials are valid and the account is active, the system shall generate an access token and refresh token using JWT authentication. If the credentials are invalid or the account is inactive, the system shall reject the login request.

## FR-02: Role-Based Redirection

After a successful login, the system shall identify the user role from the authenticated user data and redirect the user to the correct workspace:

-   Admin shall be redirected to the Admin Dashboard.

-   Manager shall be redirected to the Manager Dashboard.

-   Employee shall be redirected to the Employee Dashboard.

## FR-03: Protected Route Access

The system shall protect all private pages and API endpoints. A user shall only be allowed to access a function if the user has a valid token and the required permission.

If the user is not authenticated, the system shall redirect the user to the login page. If the user is authenticated but does not have sufficient permission, the system shall return an access denied response.

## FR-04: Permission Checking

The system shall check permissions based on the RBAC model before allowing access to sensitive operations. The permission check shall use:

-   roles

-   permissions

-   role_permissions

-   users

The system shall return an Allow or Deny decision for each protected action.

***Note:** This check is action-level only ("can this role perform this kind of action at all"). It does not determine which specific records the user may act on. See FR-121 for the separate row-level scope mechanism.*

## FR-05: User Logout

**\[CHANGED\]** Corrected reference from "Redis or equivalent rather than storing in MySQL" to "rather than storing in the primary relational database" --- wording was inconsistent with the rest of the document and ambiguous about which database engine is authoritative.

The system shall allow authenticated users to log out. When a user logs out, the system shall invalidate the current session/token mechanism according to the authentication strategy. Token blacklist handling shall be performed through Redis or an equivalent in-memory cache mechanism rather than storing logout tokens in the primary relational database.

## FR-06: Forgot Password

The system shall allow users to request password recovery by entering their registered email address.

The system shall validate whether the email exists in the users table. If valid, the system shall create a one-time reset token in the password_resets table and send a password reset email through the Email Service.

## FR-07: Reset Password

The system shall allow users to reset their password using a valid reset token.

The system shall verify that the reset token exists, has not expired, and has not been used. If the token is valid, the system shall update the user password and mark the token as used. If the token is invalid, expired, or already used, the system shall reject the reset request.

# 3. Role and Permission Management Requirements

## FR-08: Manage Roles

The system shall allow Admin to manage system roles. Each role shall include a role code, role name, and description.

The default role structure shall support:

-   Admin

-   Manager

-   Employee

The system shall prevent duplicate role codes.

## FR-09: Manage Permissions

The system shall allow Admin to manage permission records. Each permission shall represent a specific protected action in the system, such as creating clients, assigning tasks, logging timesheets, locking timesheets, or exporting reports.

The system shall prevent duplicate permission codes.

## FR-10: Assign Permissions to Roles

The system shall allow Admin to assign one or more permissions to a role.

The system shall store role-permission mappings in the role_permissions table. The system shall prevent duplicate mappings between the same role and permission.

## FR-11: Permission Auditability

The system shall record audit logs when Admin creates, updates, or changes role-permission configurations.

# 4. User Account Management Requirements

## FR-12: Create User Account

The system shall allow Admin to create user accounts.

A user account shall include:

-   Email

-   Password

-   Role

-   Active status

The system shall require the email to be unique. The system shall store authentication information in the users table and personal profile information separately in the employee_profiles table.

## FR-13: Update User Account

The system shall allow Admin to update user account information, including role assignment and active status.

The system shall prevent updates that violate database constraints or break referential integrity.

## FR-14: Lock or Unlock User Account

The system shall allow Admin to lock or unlock a user account by changing the is_active status.

When an account is locked, the user shall no longer be able to log in or access protected system functions. The system shall not physically delete user records when the purpose is offboarding or access revocation, because task history, log work history, comments, reports, and audit logs must remain traceable.

## FR-15: View User List

The system shall allow Admin to view the list of user accounts with relevant account status and role information.

The user list should support searching, filtering, and pagination.

## FR-16: User Profile Creation

When a user account is created, the system shall support creating a related employee profile record containing personal information such as full name, phone number, department, and avatar URL.

The users table shall store core authentication data only, while the employee_profiles table shall store personal profile data.

# 5. Department and Team Management Requirements

## FR-17: Create Department

**\[CHANGED\]** Clarified that the department-level manager field is a directory attribute, not an access-control mechanism, to remove the dual-scope ambiguity present in the original revision.

The system shall allow Admin to create departments or teams, for organizational and directory purposes.

Each department shall include:

-   Department name

-   Description

-   Manager in charge, if available (directory label only --- see Note)

The system shall prevent duplicate department names.

***Note:** departments.manager_id identifies who is organizationally responsible for a department for directory and HR-reporting purposes. It is NOT used to compute Manager access scope. Access scope is determined exclusively by jobs.manager_id, as defined in FR-99 and FR-117.*

## FR-18: Update Department

The system shall allow Admin to update department information, including department name, description, and assigned manager.

If the assigned manager is removed from the system, the department shall remain available and the manager field may become empty until another manager is assigned.

## FR-19: Assign Employee to Department

The system shall allow authorized users to assign or move an employee profile to a department.

The system shall update the department_id field in employee_profiles. The system shall prevent invalid assignments to non-existing departments.

***Note:** Department assignment is independent of task or job assignment. Moving an employee to a different department does not change which jobs, tasks, or timesheets a Manager can see for that employee; that visibility continues to be governed solely by job assignment (see FR-99, FR-117).*

## FR-20: Team Directory

**\[CHANGED\]** Replaced "within the manager's relevant department, team, or managed project scope" (ambiguous, three possible interpretations) with a single concrete rule based on job assignment, consistent with the job-based scope decision.

The system shall allow Manager to view employee profiles of employees who are currently assigned to at least one task under a job where jobs.manager_id equals the Manager\'s user ID.

The directory shall show basic contact information such as full name, email, phone number, department, and avatar if available.

Added a separate visibility rule to resolve a gap with FR-34: Manager could not assign a task to an Employee who had no prior task under the Manager\'s jobs, since the Team Directory rule alone did not expose such an Employee. In addition to the team directory rule above, for the specific purpose of task assignment, Manager may search and view basic profile information (full name, email, department) of any active Employee, regardless of prior task assignment. This expanded visibility is limited to basic identification fields only; detailed timesheet, performance, and report data for an Employee remain restricted to the job-based scope defined in FR-99, and are not granted by this assignment-search capability

# 6. Client Management Requirements

## FR-21: Create Client

The system shall allow Admin to create client records.

A client record shall include:

-   Client name

-   Tax code

-   Contact person

-   Contact email

-   Contact phone

-   Active status

The system shall require the tax code to be unique.

## FR-22: View Client List

The system shall allow Admin to view the list of clients.

The client list shall support searching, filtering, pagination, and active/inactive status display.

Clarified Manager\'s read-only access to active clients, needed to resolve job creation (FR-26) without granting client management rights. Manager may view a read-only list of active clients for the sole purpose of selecting a client when creating a job. This view shall not expose inactive clients and shall not allow create, update, or deactivate actions, which remain exclusive to Admin (FR-21, FR-23, FR-24).

## FR-23: Update Client

The system shall allow Admin to update client information.

The system shall validate unique fields and prevent invalid updates.

## FR-24: Deactivate Client

The system shall not physically delete client records during normal business use. If a client is no longer active, the system shall allow Admin to deactivate the client by setting is_active to false.

Deactivated clients shall remain in the database to preserve historical job and reporting data.

## FR-25: Client Integrity Check for Job Creation

When creating a job, the system shall verify that the selected client exists and is active. A job shall not be created under an inactive or non-existing client.

# 7. Master Job Management Requirements

## FR-26: Create Job

**\[CHANGED\]** Added explicit statement that jobs.manager_id is the scope-owner, to anchor the job-based scope model at the point where it is created.

The system shall allow Admin or authorized Manager users to create a master job.

A job shall include:

-   Client

-   Manager in charge

-   Job name

-   Description

-   Start date

-   Deadline

-   Status

The system shall require each job to belong to one client and exactly one manager. The assigned manager (jobs.manager_id) becomes the access-scope owner of the job, per FR-99 and FR-117.

## FR-27: Validate Job Date Range

The system shall validate that the job deadline is not earlier than the job start date.

Invalid date ranges shall be rejected.

## FR-28: Update Job

Resolved ambiguity in \"where permitted\" by explicitly restricting manager reassignment to Admin only, given the high-impact nature already noted below. The system shall allow Admin to update any job\'s information, including description, deadline, status, and assigned manager (jobs.manager_id). Manager may update description, deadline, and status for jobs within their own scope (jobs.manager_id equals their user ID), as permitted by the rules in FR-27 and FR-29, but Manager shall NOT be permitted to change jobs.manager_id under any circumstance, including for jobs within their own current scope. Only Admin may reassign jobs.manager_id. The system shall record audit logs for sensitive job updates, especially deadline changes, status changes, and manager changes.

  ------------------------- ---------------------- -------------------------
  Field                     Manager update         Admin update

  job_name                  Có                     Có

  description               Có                     Có

  deadline                  Có (theo rule FR-29)   Có

  status                    Có (theo rule FR-29)   Có

  manager_id                Không                  Có
  ------------------------- ---------------------- -------------------------

\*\*\*Note: \*\*\*\*Reassigning jobs.manager_id immediately transfers access scope for that job and all of its tasks and timesheets to the new manager, and immediately removes that scope from the previous manager. This is a high-impact operation, restricted to Admin only as stated above, and must always be audit-logged (FR-43)*.*

## FR-29: Job Status Management

The system shall support job statuses such as:

-   Planning

-   Active

-   Completed

-   On Hold

-   Cancelled

The system shall allow authorized users to update job status according to business rules.

The following table defines the allowed job status transitions. Any transition not listed in this table shall be rejected by the backend.

From Status \| To Status \| Allowed Actor \| Condition

PLANNING \| ACTIVE \| Admin, Manager assigned to the job \| Job is ready to start.

PLANNING \| CANCELLED \| Admin, Manager assigned to the job \| Cancellation reason is required.

ACTIVE \| ON_HOLD \| Admin, Manager assigned to the job \| Hold reason is required.

ON_HOLD \| ACTIVE \| Admin, Manager assigned to the job \| Job is resumed.

ACTIVE \| COMPLETED \| Admin, Manager assigned to the job \| All non-cancelled tasks under the job must be COMPLETED, and there must be no PENDING log work records under the job.

ACTIVE \| CANCELLED \| Admin, Manager assigned to the job \| Cancellation reason is required.

ON_HOLD \| CANCELLED \| Admin, Manager assigned to the job \| Cancellation reason is required.

COMPLETED \| ACTIVE \| Admin only \| Reopen reason is required and must be audit-logged.

CANCELLED \| ACTIVE \| Admin only \| Restore reason is required and must be audit-logged.

A Manager may update job status only for jobs where jobs.manager_id equals the Manager\'s own user ID. Admin may update job status globally. All job status changes must be audit-logged.

A job shall not be marked as COMPLETED while it still has tasks in TODO, IN_PROGRESS, or REVIEWING status. A job shall not be marked as COMPLETED while it still has PENDING log work records.

## FR-30: Restrict Job Deletion

The system shall prevent physical deletion of jobs when the job is referenced by tasks or historical records.

If a job should no longer be used, the system shall change its status rather than deleting it.

## FR-31: Manager Data Isolation for Jobs

**\[CHANGED\]** Made the scope rule literal and unambiguous ("jobs.manager_id equals their own user ID") instead of the general phrase "authorized management scope."

Manager users shall only view and manage jobs where jobs.manager_id equals their own user ID.

A Manager shall not be able to access jobs managed by other managers.

# 8. Task and Kanban Management Requirements

## 8.1 Task Status Transition Table

The following table is the authoritative definition of allowed task status transitions. Any transition not listed in this table shall be rejected by the backend, regardless of the requesting user\'s role.

Note: this table also governs Kanban cross-column drag-and-drop actions (FR-39), in addition to explicit status update requests submitted through other means.

  -------------------------------- --------------- ---------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------
  **From Status**                  **To Status**   **Allowed Actor**                              **Trigger / Condition**

  Todo                             In Progress     Assignee (Employee), Manager                   Employee starts working on the task.

  In Progress                      Reviewing       Assignee (Employee)                            Employee submits the task for review.

  In Progress                      Todo            Assignee (Employee), Manager                   Work is paused or reverted before submission.

  Reviewing                        Completed       Manager (assigned to the task\'s job)          Manager approves the submitted result.

  Reviewing                        In Progress     Manager (assigned to the task\'s job)          Manager rejects the submitted result. The rejection reason shall be recorded as a task comment with comment_type = REJECTION_NOTE.

  Todo / In Progress / Reviewing   Cancelled       Manager (assigned to the task\'s job), Admin   Task is no longer needed. Cancellation is only allowed before Completed.

  Completed                        (none)          (none)                                         Completed is a terminal state. No further transition is allowed through normal workflow.

  Cancelled                        (none)          (none)                                         Cancelled is a terminal state. No further transition is allowed through normal workflow.
  -------------------------------- --------------- ---------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------

## FR-32: Create Task

**\[CHANGED\]** Added explicit scope check at task creation time, consistent with job-based scope.

The system shall allow Manager to create tasks under a job where jobs.manager_id equals the Manager\'s own user ID.

A task shall include:

-   Job

-   Assignee

-   Creator

-   Title

-   Description

-   Priority

-   Status

-   Deadline

-   Order index

The system shall require every task to belong to a valid job and be assigned to a valid user. The system shall reject task creation if the requesting Manager is not the manager of the parent job.

Added job-status validation at task creation time, for consistency with the status-checking pattern already established for log work in FR-120. The system shall reject task creation if the parent job\'s status is COMPLETED or CANCELLED. If the parent job\'s status is ON_HOLD, task creation shall be rejected unless the job is first resumed (status changed back to ACTIVE or PLANNING)

  --------------------------------------------------------------------------
  Job status                          Cho phép tạo Task mới?
  ----------------------------------- --------------------------------------
  PLANNING                            Có

  ACTIVE                              Có

  ON_HOLD                             Không, trừ khi job được resume trước

  COMPLETED                           Không

  CANCELLED                           Không
  --------------------------------------------------------------------------

## FR-33: Validate Task Deadline

The system shall validate that a task deadline does not exceed the deadline of its parent job.

If the task deadline is later than the job deadline, the system shall reject the task creation or update request.

## FR-34: Assign Task to Employee

The system shall allow Manager to assign a task to an Employee, provided the task belongs to a job where jobs.manager_id equals the Manager\'s own user ID.

The assigned Employee shall be able to view the task in the personal task workspace.

The system may automatically add relevant users to task_followers so that they can receive notifications about task changes.

## FR-35: Task Priority Management

The system shall support task priority values:

-   Low

-   Medium

-   High

The system shall allow Manager to set or update the priority of a task, within the Manager\'s job scope.

## FR-36: Task Status Management

**\[CHANGED\]** Replaced the open-ended phrase "shall control which role can perform each status transition" with a binding reference to the explicit transition table in Section 8.1.

The system shall support task statuses:

-   Todo

-   In Progress

-   Reviewing

-   Completed

-   Cancelled

The system shall enforce the transition table defined in Section 8.1 for every status change request. Completed and Cancelled are terminal states; no further transition out of either state is permitted through the normal workflow.

## FR-37: Employee Task Progress Update

The system shall allow Employee to update the status of assigned tasks strictly according to the transitions permitted to the Assignee role in Section 8.1.

An Employee may move a task toward progress (Todo to In Progress) or submit it for review (In Progress to Reviewing), but shall not be allowed to approve a task into Completed; that transition belongs exclusively to the Manager of the task\'s job.

Unauthorized status transitions shall be rejected.

## FR-38: Kanban Board View

The system shall provide a Kanban board for task tracking.

The Kanban board shall display tasks by status columns and allow authorized users to view task progress visually.

## FR-39: Kanban Drag and Drop

Distinguished two categories of drag-and-drop action to resolve a potential conflict with the Task Status Transition Table (Section 8.1)

The system shall distinguish two types of drag-and-drop actions:

\(a\) Reordering within the same status column: this updates only order_index and does not constitute a status change. No transition validation is required.

\(b\) Dragging a task across status columns: this constitutes a status transition and must invoke the same validation as the Task Status Transition workflow defined in Section 8.1. A cross-column drag that does not correspond to a valid transition in Section 8.1 shall be rejected by the backend. The frontend should disable or visually prevent drops onto columns that are not reachable from the task\'s current status, to avoid a poor user experience, but the backend rejection is the authoritative enforcement point regardless of frontend behavior.

The system shall store the task order using order_index. The order_index shall use a string-based ordering approach to support stable ordering and avoid numeric precision problems during repeated drag-and-drop operations..

## FR-40: Task Filtering and Sorting

The system shall allow users to filter and sort tasks by:

-   Status

-   Deadline

-   Priority

-   Job

-   Assignee, where permitted

Employee users shall only see tasks assigned to them or tasks they are allowed to follow. Manager users shall only see tasks under jobs within their job-based scope (FR-99).

## FR-41: Task Review Workflow

**\[CHANGED\]** Fixed the ambiguous "move back to an appropriate working status such as In Progress" into a single deterministic target state, and required a comment_type field so rejection notes are identifiable. \[DB IMPACT: task_comments.comment_type\]

The system shall allow Manager to review tasks submitted by Employee, for tasks belonging to a job where jobs.manager_id equals the Manager\'s own user ID.

If the task result is accepted, the Manager shall approve the task and the system shall update the task status to Completed. The system shall record the completion timestamp in completed_at.

If the task result is rejected, the system shall move the task back to In Progress (per the transition table in Section 8.1) and shall record the rejection reason as a task comment with comment_type set to REJECTION_NOTE, so that the rejection note is distinguishable from ordinary discussion comments in the UI.

## FR-42: Review Notification

**\[CHANGED\]** Linked to the new event_type model so review notifications are filterable/routable by category.

The system shall send notifications when a task is submitted for review, approved, or rejected.

The notification shall be sent to relevant users such as assignee, creator, and followers, and shall carry event_type values TASK_SUBMITTED, TASK_APPROVED, or TASK_REJECTED respectively (see FR-69, FR-119).

## FR-43: Task Audit Logging

The system shall record audit logs for sensitive task actions, including task creation, assignment, status change, review approval, review rejection, deadline changes, and cancellation.

# 9. Task Comment Requirements

## FR-44: Add Task Comment

**\[CHANGED\]** Added comment_type to the comment data model so rejection notes can be distinguished from normal discussion in queries and UI rendering. \[DB IMPACT: task_comments.comment_type\]

The system shall allow authorized users to add comments to a task.

Each comment shall include:

-   Task

-   User

-   Comment content

-   Comment type (NORMAL or REJECTION_NOTE)

-   Created time

The system shall require comment content to be non-empty. Comments created directly by a user through the comment UI shall always be recorded with comment_type = NORMAL; only the system-generated rejection flow (FR-41) may create a comment with comment_type = REJECTION_NOTE.

## FR-45: View Task Comment History

The system shall allow authorized users to view task comments in chronological order, with comment_type visibly distinguishing rejection notes from normal discussion.

The comment history shall support task discussion, progress reporting, and review/rejection notes.

## FR-46: Comment Notification

When a new comment is added to a task, the system shall notify relevant task followers or assigned users, with event_type = TASK_COMMENT.

## FR-47: Preserve Comment History

The system shall preserve comment history for traceability. Comments shall not be lost simply because a user account is locked.

# 10. Task Follower Requirements

## FR-48: Maintain Task Followers

The system shall maintain a list of users following each task.

The follower list shall be used to determine who receives task-related notifications.

## FR-49: Prevent Duplicate Followers

The system shall prevent the same user from being added as a follower of the same task more than once.

## FR-50: Use Followers for Notification Routing

When a task event occurs, the system shall resolve notification recipients based on task followers and relevant task participants.

# 11. Task Attachment Requirements

## FR-51: Upload Task Attachment

The system shall allow authorized users to upload files to a task.

An attachment shall include:

-   Task

-   User

-   File name

-   File URL

-   File size

-   Uploaded time

## FR-52: Validate Attachment Permission

Before uploading an attachment, the system shall verify that the task exists and that the user has permission to attach a file to that task.

If the task does not exist or the user has no permission, the system shall reject the upload.

## FR-53: Store Attachment Metadata

The system shall store physical files through the File Storage Service and store file metadata in task_attachments.

The system shall not store large raw file data directly in the main relational tables.

## FR-54: Attachment Notification and Audit

The system shall generate a notification (event_type = TASK_ATTACHMENT) and audit event when an uploaded file is considered relevant to task evidence, review, or completion.

# 12. Timesheet and Log Work Requirements

## FR-55: Log Work Hours

The system shall allow Employee to log work hours for a task.

A log work record shall include:

-   Task

-   User

-   Work date

-   Hours spent

-   Description

-   Created time

-   Updated time

The system shall require the task and user to be valid.

## FR-56: Validate Log Work Access

The system shall only allow users to log work for tasks they are permitted to access.

Employee users shall not be able to log work under unrelated tasks.

## FR-57: Validate Work Date Against Time Lock

**\[CHANGED\]** Cross-referenced the new FR-120 so the time-lock check and the job/task-status/future-date checks are understood as separate, both-required validations rather than alternatives.

Before creating, updating, or deleting log work, the system shall check whether the corresponding month and year are locked, by checking for the existence of EITHER: (a) a GLOBAL-scoped time lock for that month/year, OR (b) a JOB-scoped time lock for that month/year where job_id equals the log work\'s parent task\'s job_id. If either lock exists, the system shall reject the operation. This check is in addition to, and independent of, the job/task status and future-date validation defined in FR-120..

## FR-58: Prevent More Than 24 Hours Per Day

The system shall prevent a user from logging more than 24 total hours on the same work date.

The system shall maintain daily totals in daily_user_timesheets and enforce the rule that total_hours must not exceed 24 hours.

## FR-59: Daily Total Accumulation

When a log work record is created, updated, or deleted, the system shall update the corresponding daily total for that user and work date.

The system shall use a transaction-safe mechanism to prevent race conditions when multiple requests are submitted at nearly the same time.

## FR-60: Create Log Work Transaction

**\[CHANGED\]** Inserted the FR-120 status/date check into the transaction sequence, between the time-lock check and the daily-total read, so the new validation is not bypassable.

When creating a log work record, the system shall perform the following sequence:

-   Check whether the period is locked.

-   Check job/task status and work-date validity per FR-120.

-   Lock or safely read the daily total row.

-   Calculate the new total hours.

-   Reject the request if the total exceeds 24 hours.

-   Insert the log work record.

-   Update the daily total.

-   Commit the transaction.

## FR-61: Update Log Work

The system shall allow Employee to update log work records only if the period is not locked, the parent job/task status still permits logging per FR-120, and the user has permission to modify the record.

The system shall recalculate daily totals after successful updates.

## FR-62: Delete Log Work

**\[CHANGED\]** Replaced physical deletion with a void mechanism to comply with CS-09 (preserve log work history). Hard-deleting log_works was inconsistent with the soft-delete pattern used elsewhere in the system (users, clients). The system shall allow Employee to void log work records only if the period is not locked and the user has permission to modify the record. Voiding is permitted even if the parent job/task has since moved to Completed or Cancelled, since voiding only marks erroneous history as invalid and does not create new hours against a closed job/task. Voiding a log work record shall set review_status to VOIDED rather than physically removing the record from the database. The system shall recalculate daily totals after a successful void, excluding voided records from the total. Voided records shall remain in the database for audit and traceability purposes, consistent with CS-09.

## FR-63: Timesheet Detail Review

**\[CHANGED\]** Replaced "employees within the Manager's authorized scope" with the literal job-based scope definition, removing the dependency on department scope.

The system shall allow Manager to view detailed log work records for employees who are assignees of tasks under jobs where jobs.manager_id equals the Manager\'s own user ID.

The Manager shall be able to filter timesheet records by date range, employee, job, task, and status where applicable.

# 13. Time Lock Requirements

## FR-64: Lock Timesheet Period

The system shall allow Manager to lock a timesheet period for a specific job, provided jobs.manager_id equals the Manager\'s own user ID (per FR-99). When a Manager locks a period, the lock shall be created with lock_scope = JOB and job_id set to the target job\'s ID; this lock applies only to log_works under tasks belonging to that specific job. The system shall allow Admin to lock either a specific job (lock_scope = JOB) or the entire system for a period (lock_scope = GLOBAL, job_id = NULL).

When a period is locked, users shall not be able to create, update, or delete log work records within that period for the affected job(s).

## FR-65: Unlock Timesheet Period

The system shall allow authorized users to unlock a previously locked timesheet period within their permitted scope.

Unlocking a time lock shall update the existing time_locks record instead of creating a new duplicate row. The system shall set is_locked = false and record unlocked_by, unlocked_at, and unlock_reason. The unlock reason is required because unlocking a previously closed timesheet period is a sensitive operation.

After unlocking, valid users may create, update, correct, or void log work records in that period according to permission rules, task/job status rules, and audit requirements.

Every unlock operation shall be recorded in audit_logs with actor, affected lock record, old values, new values, reason, and timestamp.

## FR-66: Prevent Duplicate Time Locks

Resolved the system-wide locking limitation previously noted here by introducing lock_scope and job_id fields, allowing job-level locks alongside system-wide Admin locks, so that a Manager managing multiple jobs may lock each job independently as it is completed (e.g. Job A locked in week 1, Job B locked in week 3 of the same month).

The system shall prevent duplicate time lock records according to the lock scope.

For JOB-scoped locks, the system shall allow at most one lock record for each lock_month, lock_year, and job_id combination.

For GLOBAL-scoped locks, the system shall allow at most one global lock record for each lock_month and lock_year combination, where lock_scope = GLOBAL and job_id is NULL.

Because PostgreSQL does not treat NULL values as equal in ordinary unique constraints, the system shall not rely on a single unique constraint over (lock_month, lock_year, lock_scope, job_id). Instead, the database shall enforce two separate partial unique constraints:

-   unique_global_time_lock: unique by lock_month and lock_year where lock_scope = GLOBAL and job_id IS NULL.

-   unique_job_time_lock: unique by lock_month, lock_year, and job_id where lock_scope = JOB and job_id IS NOT NULL.

If a matching time lock record already exists, lock or unlock operations shall update the existing record instead of creating a duplicate row. Every lock and unlock action must be audit-logged..

## FR-67: Record Lock Actor

The system shall record the user who locks a timesheet period through locked_by and locked_at, and the user who unlocks a timesheet period through unlocked_by and unlocked_at. Lock and unlock reasons shall be stored in lock_reason and unlock_reason when applicable. In addition, every lock and unlock action must be recorded in audit_logs for full historical traceability.

## FR-68: Time Lock Notification and Audit

The system shall send notifications (event_type = TIMESHEET_LOCK or TIMESHEET_UNLOCK) and generate audit logs when a timesheet period is locked or unlocked.

# 14. Notification Requirements

## FR-69: Receive System Events

**\[CHANGED\]** Converted the prose event list into a fixed set of event_type values that map directly onto the new event_type column. \[DB IMPACT: notifications.event_type\]

The notification module shall receive events from system management, task management, timesheet management, and other relevant modules. Each event shall carry an event_type value identifying the business event, independent of the delivery channel used to send it (see FR-119).

Events may include:

-   TASK_ASSIGNED

-   TASK_STATUS_CHANGED

-   TASK_COMMENT

-   TASK_SUBMITTED

-   TASK_APPROVED

-   TASK_REJECTED

-   TASK_ATTACHMENT

-   TIMESHEET_LOCK

-   TIMESHEET_UNLOCK

-   REPORT_EXPORTED

-   ACCOUNT_OR_PERMISSION_CHANGED

-   LOG_WORK_APPROVED

-   LOG_WORK_REJECTED

-   LOG_WORK_VOIDED

Added three event_type values to align notification coverage with the log work review mechanism introduced in FR-62 (review_status, reviewed_by, adjustment_reason).

LOG_WORK_APPROVED, LOG_WORK_REJECTED, and LOG_WORK_VOIDED shall be triggered when a Manager changes a log work record\'s review_status to APPROVED, REJECTED, or VOIDED respectively. The notification recipient shall be the Employee who owns the log work record (log_works.user_id), so the Employee is informed when their submitted hours are reviewed or corrected.

## FR-70: Resolve Notification Recipients

The system shall determine notification recipients based on task followers, assigned users, creators, managers, and other relevant users.

## FR-71: Persist Notifications

The system shall store notifications in the notifications table so users can view notification history even if they were offline when the event occurred.

## FR-72: Realtime Notification Delivery

The system shall send realtime notification payloads through the Realtime Gateway for users who are online.

## FR-73: Email Notification Delivery

The system shall send email notifications through the Email Service when the notification\'s delivery-channel type requires email delivery.

## FR-74: Track Email Delivery Status

The system shall record whether an email notification has been sent successfully and record the sent time when applicable.

## FR-75: Notification Center

**\[CHANGED\]** Added event_type filtering capability now that the field exists.

The system shall provide a notification center where users can view previous notifications, with the ability to filter by event_type.

The system shall support unread/read status.

## FR-76: Mark Notification as Read

The system shall allow users to mark notifications as read.

The system shall update the is_read status in the notifications table.

# 15. Profile Management Requirements

## FR-77: View Own Profile

The system shall allow each authenticated user to view their own profile information.

Profile information may include:

-   Full name

-   Email

-   Phone number

-   Department

-   Avatar

## FR-78: Update Own Profile

The system shall allow users to update permitted profile fields such as full name and phone number.

The system shall not allow users to update restricted fields such as role or account active status through the personal profile page.

## FR-79: Upload Avatar

The system shall allow users to upload an avatar image.

The system shall store the image file through the File Storage Service and save the returned avatar URL in employee_profiles.

## FR-80: View Directory Profile

The system shall allow authorized users to view profile information of other users when required for team coordination, task assignment, or directory lookup.

Access shall be limited based on role and job-based scope, per FR-99.

## FR-81: Profile Audit Logging

The system shall create an audit log when sensitive profile information is updated.

# 16. Dashboard and Analytics Requirements

## FR-82: Admin Global Dashboard

The system shall provide an Admin dashboard showing global system metrics.

The dashboard shall include indicators such as:

-   Total active clients

-   Total active jobs

-   Total work hours in the selected month

-   Task status overview

-   Company-level performance summary

## FR-83: Manager Dashboard

**\[CHANGED\]** Replaced "authorized scope" with the literal job-based rule.

The system shall provide a Manager dashboard showing only data from jobs where jobs.manager_id equals the Manager\'s own user ID, and tasks/timesheets under those jobs.

The dashboard shall include indicators such as:

-   Team task status

-   Overdue task rate

-   Team work hours

-   Employee workload comparison

-   Heatmap or productivity visualization

## FR-84: Employee Personal Dashboard

The system shall provide an Employee dashboard showing personal work information.

The dashboard shall include indicators such as:

-   Assigned tasks

-   Overdue personal tasks

-   Total logged hours in the current week or month

-   Personal task completion rate

-   Personal KPI summary

## FR-85: Data Isolation in Analytics

**\[CHANGED\]** Tied the Manager bullet to the concrete job-based scope rule.

The system shall enforce data isolation in analytics:

-   Admin may view global data.

-   Manager may view only data from jobs within the Manager\'s job-based scope (FR-99).

-   Employee may view only personal data.

The system shall enforce this rule at backend level, not only at frontend level.

# 17. Reporting and Export Requirements

## FR-86: Generate Admin Reports

The system shall allow Admin to generate reports across the entire system.

Report data may include clients, jobs, tasks, users, departments, timesheets, and performance metrics.

## FR-87: Generate Manager Reports

**\[CHANGED\]** Replaced "authorized scope" / "unrelated teams or jobs" with the literal job-based rule.

The system shall allow Manager to generate reports only for jobs where jobs.manager_id equals the Manager\'s own user ID.

A Manager shall not be able to export reports containing data from jobs managed by other managers.

This restriction applies regardless of any other filter selected (including Department, per FR-88); no filter combination shall allow a Manager to retrieve data outside their job-based scope.

## FR-88: Timesheet Detail Report

The system shall provide a detailed timesheet report based on log work data.

The report shall support filters such as:

-   Date range

-   Employee

-   Department

-   Job

-   Task

-   Task status

-   Review status (PENDING, APPROVED, REJECTED, VOIDED)

-   Locked period status

By default, the timesheet detail report shall exclude log work records with review_status = VOIDED. An optional filter may allow Admin or Manager to include voided records for audit purposes.

Clarified that the Department filter is a secondary refinement only and must never be used to expand a Manager\'s data access beyond their job-based scope (FR-99), since departments.manager_id carries no access-control meaning (FR-17, BR-26).

The Department filter shall only narrow results within data the requesting user is already authorized to see. For Manager, all report results remain bounded by the job-based scope defined in FR-99 regardless of which Department filter value is selected; selecting a Department shall never reveal log work records from jobs outside the Manager\'s scope, even if employees in that department happen to work under a different Manager\'s jobs. For Admin, the Department filter operates without this restriction, consistent with the Admin\'s global access scope (FR-98)

## FR-89: Export Report to File

The system shall allow authorized users to export reports in PDF or Excel format.

The generated file shall be returned to the user as a temporary downloadable file.

## FR-90: Read-Only Reporting Process

The reporting module shall not modify business data.

The reporting process shall only read data, aggregate data, and generate output files.

## FR-91: Report Export Audit

The system shall record an audit log whenever a user exports a report.

The audit log shall include actor, export time, filter conditions, report type, and file format.

## FR-122: Task Summary Report

**\[NEW\]** Added per request to provide task-level reporting alongside the existing timesheet-level report.

The system shall provide a task summary report aggregating task counts and status breakdowns.

The report shall support filters such as:

-   Date range (based on task created_at or completed_at)

-   Job

-   Assignee

-   Priority

-   Status

The report shall include, at minimum: total tasks, tasks by status, overdue task count, average time-to-completion (from created_at to completed_at, for Completed tasks only), and rejection count (number of tasks that received at least one REJECTION_NOTE comment before completion).

Admin may generate this report across all jobs. Manager may generate this report only for jobs where jobs.manager_id equals the Manager\'s own user ID.

## FR-123: Employee Performance Report

**\[NEW\]** Added per request to provide individual performance visibility alongside the existing timesheet-level and new task-level reports.

The system shall provide an employee performance report aggregating an individual employee\'s task and timesheet activity over a selected period.

The report shall support filters such as:

-   Date range

-   Employee

-   Job (optional, to scope to a single job)

The report shall include, at minimum: total tasks completed, total tasks rejected at least once, total logged hours, average daily logged hours, and on-time completion rate (Completed tasks where completed_at is on or before deadline, divided by total Completed tasks in the period).

Admin may generate this report for any employee. Manager may generate this report only for employees who are assignees of tasks under jobs where jobs.manager_id equals the Manager\'s own user ID. Employee may generate this report only for themselves.

***Note:** This report aggregates and presents existing operational data (task and timesheet records) for performance visibility. Per the Functional Boundary (Section 22), it shall not be interpreted as, or connected to, payroll, compensation, or formal HR performance review processes.*

## FR-124: Manager Log Work Review and Correction

The system shall allow Manager to review log work records under jobs where jobs.manager_id equals the Manager\'s own user ID.

Manager may approve, reject, correct, or void log work records within their job-based scope.

Correction or voiding must require a reason and must be recorded in audit_logs with old_values and new_values.

Manager shall not physically delete log work records. Invalid records shall be marked as VOIDED.

If Manager corrects hours_spent, work_date, or task_id, the system shall recalculate affected daily_user_timesheets within the same database transaction.

# 18. Audit Log Requirements

## FR-92: Collect Audit Events

The system shall collect audit events from sensitive operations in the system.

Sensitive operations include:

-   User creation

-   User update

-   User lock or unlock

-   Role and permission changes

-   Client creation or update

-   Client deactivation

-   Job creation or update

-   Task assignment

-   Task status change

-   Task review approval or rejection

-   Timesheet lock or unlock

-   log work creation, update, review approval, review rejection, correction, or voiding

-   Profile update

-   Report export

## FR-93: Store Audit Logs

**\[CHANGED\]** Clarified that ip_address is nullable, since not every audited action originates from an HTTP request with a client IP (e.g. scheduled jobs, system-initiated unlocks).

The system shall store audit logs in the audit_logs table.

Each audit log shall include:

-   User who performed the action

-   Action name

-   Table name

-   Record ID

-   Old values

-   New values

-   IP address (may be null for system-initiated or background-job actions)

-   Created time

## FR-94: Preserve Audit History

The system shall preserve audit records even if the related user account is later removed or inactive.

If the user reference becomes unavailable, the audit record shall remain available for investigation.

## FR-95: Search Audit Logs

The system shall allow Admin to search and filter audit logs by:

-   Actor

-   Action

-   Table name

-   Record ID

-   Date range

-   Keyword

## FR-96: View Audit Details

The system shall allow Admin to view detailed before-and-after data for audited changes using old_values and new_values.

## FR-97: Audit Log Access Control

Added a scoped activity history capability for Manager, distinct from full audit log access, to resolve a gap where Manager had no way to review the history of sensitive actions (job updates, task transitions, timesheet locks) even within their own job scope.

Only Admin shall be able to access the full, unfiltered audit log (all actions across all tables and all users), per FR-95 and FR-96. Manager and Employee users shall not be able to browse global audit history. In addition, Manager may view a scoped activity history: audit log entries where table_name and record_id correspond to a job within the Manager\'s job-based scope (FR-99), or to a task, log work, or time lock record that belongs to such a job. This scoped view shall use the same underlying audit_logs data as the Admin audit log (no separate table), filtered at the API/query level by the Manager\'s job-based scope, consistent with the row-level scope enforcement principle in FR-121.

Manager\'s scoped activity history shall not expose old_values/new_values for actions outside their scope, and shall not expose audit entries for jobs managed by other managers, user account changes, role/permission changes, or client changes, which remain Admin-only regardless of scope

# 19. Data Access and Scope Requirements

## FR-98: Admin Access Scope

Admin shall have access to global system administration functions, including users, roles, permissions, departments, clients, jobs, reports, and audit logs.

## FR-99: Manager Access Scope

**\[CHANGED\]** This is the central fix of this revision: replaced the abstract "authorized scope" phrase, which was used inconsistently against both job-based and department-based interpretations elsewhere in the document, with one literal, single rule. All other FRs referencing Manager scope have been updated to point back to this definition.

A Manager\'s access scope shall be defined exclusively as the set of jobs where jobs.manager_id equals that Manager\'s own user ID, together with the tasks, timesheets, comments, attachments, employees-as-assignees, reports, and analytics that belong to those jobs.

Department-level manager assignment (departments.manager_id, FR-17) shall have no effect on this access scope.

The system shall prevent a Manager from viewing or modifying data belonging to jobs managed by another Manager.

This scope governs detailed data access (timesheets, reports, performance metrics). It does not restrict the basic employee directory search used solely for task assignment purposes, as defined in FR-20.

## FR-100: Employee Access Scope

Employee shall only access personal tasks, personal timesheets, permitted task comments, permitted task attachments, personal notifications, and personal profile information.

## FR-101: Backend-Level Authorization

The system shall enforce access control at backend level for all protected APIs.

Frontend hiding of buttons or pages shall not be considered sufficient authorization.

## FR-102: Forbidden Access Handling

When a user attempts an unauthorized operation, the system shall reject the request and return an appropriate forbidden response.

## FR-117: Job-Based Scope Resolution Rule

**\[NEW\]** Added as the canonical cross-reference target for every other FR that mentions Manager scope, so the rule is defined exactly once and referenced everywhere else, rather than restated with potentially drifting wording in each FR.

Wherever this document refers to a Manager\'s "authorized scope," "management scope," "authorized management scope," or similar phrasing, the resolution rule shall be: scope = { jobs WHERE jobs.manager_id = current_user.id }, extended transitively to tasks, log_works, comments, attachments, and notifications that reference those jobs.

This is the single canonical scope-resolution rule for the entire system. No other table or field (including departments.manager_id) shall be used to compute Manager access scope, now or through ad-hoc query logic added during implementation.

## FR-121: Separation of Action-Level and Row-Level Authorization

**\[NEW\]** Added because the original document specified the RBAC tables in detail (FR-04, FR-08--FR-10) but did not state that RBAC alone does not cover row-level scope, which is the mechanism actually responsible for most of the access rules in Section 19. Without this FR, an implementer could reasonably believe a passing role_permissions check is sufficient.

The system\'s authorization model shall be implemented as two independent, both-required mechanisms:

-   Action-level authorization (RBAC): determines whether a role is permitted to perform a category of action at all (e.g. "can a Manager update task status"), using roles, permissions, and role_permissions, per FR-04.

-   Row-level / scope authorization: determines which specific records a user is permitted to act on, using direct ownership or scope fields such as jobs.manager_id (FR-117), tasks.assignee_id, log_works.user_id, and equivalent fields on dependent tables.

A request shall only be allowed if it passes both checks. Passing the RBAC action-level check shall never be treated as sufficient on its own to authorize access to a specific record.

Backend implementation shall apply the row-level scope filter directly inside the data-access query (e.g. as a WHERE clause), not only as a post-fetch check, to avoid accidentally fetching out-of-scope data before filtering.

## FR-118: Out-of-Scope: Task Dependency and Subtasks

**\[NEW\]** Added per request to make the flat-task decision explicit, so it is not mistaken for an unaddressed gap during implementation or future review.

The current version of the system shall NOT support task dependency relationships (e.g. "task A cannot start until task B is completed") and shall NOT support subtasks or checklist items within a task.

Tasks shall remain a flat structure: each task belongs to exactly one job and has no parent task and no child tasks.

This is a deliberate scope decision for the current version, not an oversight. If dependency or subtask support is required in a future version, it will require a new linking table (e.g. task_dependencies or a parent_task_id column) and a corresponding new set of functional requirements; it is out of scope for the present database and FR revision.

# 20. External Service Integration Requirements

## FR-103: Email Service Integration

The system shall integrate with an Email Service for password reset emails and automatic notification emails.

The system shall send email requests to the Email Service and may track email status where applicable.

## FR-104: File Storage Service Integration

The system shall integrate with a File Storage Service for avatar images and task attachments.

The system shall store the file physically in the storage service and store only metadata and file URL in the database.

## FR-105: Realtime Gateway Integration

The system shall integrate with a Realtime Gateway to deliver realtime notification payloads to online users.

Realtime events shall not replace database persistence. Notifications shall still be stored so offline users can read them later.

# 21. Validation and Data Integrity Requirements

## FR-106: Unique Data Validation

The system shall enforce uniqueness for fields that require unique values, including role code, permission code, user email, department name, client tax code, role-permission mapping, task follower mapping, and time lock period (per month, year, scope, and job --- see FR-66).

## FR-107: Referential Integrity

The system shall prevent operations that would create orphan records.

Jobs must reference existing clients and managers. Tasks must reference existing jobs, assignees, and creators. Log work records must reference existing tasks and users.

## FR-108: Soft Delete for Business Records

The system shall prefer deactivation or status changes over physical deletion for business records that must preserve history, especially users and clients.

## FR-109: Restrict Deletion of Historical Records

The system shall prevent deletion of records that are referenced by important historical data such as tasks, log work, comments, reports, or audit logs.

## FR-110: Accurate Time Calculation

The system shall use decimal-based hour calculations for log work and daily totals to avoid floating-point calculation errors.

## FR-111: Race Condition Protection

The system shall use transaction-safe logic when updating daily timesheet totals so that concurrent requests cannot cause a user\'s total logged hours to exceed 24 hours per day.

## FR-112: Auditability of Sensitive Changes

Every sensitive business change shall be traceable through audit logs.

## FR-119: Notification Event Type Model

**\[NEW\]** Added to formally specify the new event_type field referenced throughout Section 14 and Section 8/9, separating "what happened" from "how it was delivered." \[DB IMPACT: notifications.event_type\]

Each notification record shall carry two independent classification fields:

-   event_type --- identifies the business event that triggered the notification (e.g. TASK_ASSIGNED, TASK_REJECTED, TIMESHEET_LOCK), used for filtering, routing, and UI rendering (icon/text per event category).

-   type --- identifies the delivery channel(s) used to send the notification (SYSTEM_ONLY, EMAIL_ONLY, or ALL), used by the delivery pipeline to decide whether to call the Email Service.

These two fields shall not be conflated. The full set of valid event_type values is defined in FR-69.

## FR-120: Log Work Validation Against Job/Task Status and Date

**\[NEW\]** Added to close the gap where, in the original revision, log_works had no relationship to the status of its parent task or job, and no protection against future-dated entries.

In addition to the time-lock check in FR-57, the system shall enforce the following validations when creating or updating a log work record:

-   work_date shall not be later than the current date (no future-dated log work entries).

-   The system shall reject creation or update of a log work record if the parent task\'s status is Cancelled.

-   The system shall reject creation or update of a log work record if the parent job\'s status is Cancelled.

-   The system shall allow creation or update of log work for tasks/jobs with status Completed only if explicitly enabled by a configuration flag (default: disabled), since employees may legitimately need to log final hours shortly after a task is marked complete; if disabled, the rejection message shall direct the user to contact their Manager to reopen the task instead.

These checks apply to record creation and update. They do not apply to deletion of an existing log work record (see FR-62).

# 22. Functional Boundary

The WorkTracker system shall focus on project management, task coordination, timesheet tracking, work performance monitoring, reporting, notification, and audit logging.

The system shall not focus on deep accounting, payroll processing, financial management, or advanced human resource management. Any payroll or financial interpretation of logged hours shall remain outside the core functional scope unless added as a future module.

Task dependency relationships and subtasks/checklists are explicitly out of scope for the current version, per FR-118. Job-scoped timesheet locking and global timesheet locking are included in the current version, as defined in FR-64, FR-65, FR-66, and CS-10.

## 2.5 Non-Functional Requirements

### 1. Overview

Non-functional requirements define the quality attributes, constraints, and operational conditions of the WorkTracker system. While functional requirements describe what the system must do, non-functional requirements describe how well the system must perform those functions.

The WorkTracker system shall be designed as a secure, reliable, maintainable, and scalable web-based application for managing work processes, task coordination, timesheet tracking, reporting, notification, and audit logging.

The system shall support three main user roles: Admin, Manager, and Employee. It shall also integrate with supporting infrastructure services such as Email Service, File Storage Service, Redis, WebSocket Gateway, and PostgreSQL database.

### 2. Security Requirements

#### NFR-01: Authentication Security

The system shall authenticate users through a secure login mechanism using email and password.

Passwords shall never be stored in plain text. The system shall store only hashed passwords using a secure password hashing mechanism supported by the backend framework.

The system shall use JWT-based authentication to manage user sessions. Access tokens and refresh tokens shall be generated only after successful authentication. A valid JWT signature alone shall not be treated as proof that the account is still permitted to act; every authenticated request shall also pass the per-request active-status check defined in NFR-04, so that an account lock takes effect immediately instead of only at token expiry or refresh.

#### NFR-02: Authorization and Access Control

The system shall enforce role-based access control at backend level.

Every protected API endpoint shall verify the authenticated user's role and permission before allowing the requested operation.

Frontend route protection and hidden buttons shall not be considered sufficient security. Backend authorization shall be the final protection layer.

#### NFR-03: Role-Based Data Isolation

The system shall isolate data access according to user role.

Admin users may access global administrative data. Manager users may only access jobs, tasks, employees, timesheets, reports, and analytics within their authorized management scope. Employee users may only access their own tasks, timesheets, notifications, and profile information.

The system shall prevent users from accessing data outside their permission scope, even if they manually modify API requests.

#### NFR-04: Account Locking

The system shall support immediate account deactivation through the `is_active` status.

When an account is locked or deactivated, the user shall no longer be able to log in or continue using protected system functions.

An account lock shall take effect immediately rather than only at the next login or token refresh. The system shall enforce this through an authentication middleware that checks the `is_active` status of the requesting user on every authenticated request, in addition to validating the JWT signature and expiry.

To avoid issuing a database query on every request at this scale of usage, the middleware shall read the active-status flag from a Redis cache keyed by user ID, populated on login and invalidated immediately whenever an Admin locks, unlocks, or otherwise deactivates the account, so the cache cannot serve a stale \"active\" value past the moment the lock is applied. If the cached value is missing or expired, the middleware shall fall back to a direct database lookup and repopulate the cache.

The system shall preserve historical data related to the locked account, including tasks, comments, log work records, reports, and audit logs.

#### NFR-05: Password Reset Security

Password reset tokens shall be unique, time-limited, and single-use.

The system shall reject expired, reused, or invalid password reset tokens.

Password reset emails shall be sent only through the configured Email Service.

#### NFR-06: Sensitive Operation Protection

Sensitive actions such as user locking, permission changes, job updates, task approval, task rejection, timesheet locking, report exporting, and profile changes shall require valid authentication and sufficient permission.

Unauthorized requests shall be rejected with an appropriate forbidden response.

#### NFR-07: Protection Against Duplicate Submission

The system shall prevent duplicate submissions caused by repeated button clicks, browser lag, or network delay.

Frontend forms shall disable the submit button while a request is being processed. Backend logic shall also validate incoming data to prevent duplicate or invalid records.

#### NFR-08: Secure File Upload

The system shall validate uploaded files before accepting them.

Uploaded files shall be checked for allowed file type, file size limit, and user permission. Files shall be stored through a File Storage Service, while only file metadata and file URL shall be stored in the database.

The system shall not expose internal storage paths directly to unauthorized users.

### 3. Performance Requirements

#### NFR-09: General Page Response Time

The system should load standard pages such as dashboard, task list, client list, job list, employee list, and profile page within an acceptable response time under normal load.

Given a target scale of 300+ concurrent users, \"acceptable\" shall mean a page render time (time to interactive, server response plus client rendering) of under 2 seconds at the 95th percentile under normal load.

For common user operations, the system should respond quickly enough to provide a smooth user experience.

#### NFR-10: API Response Time

The system should return responses for common API requests such as login, task loading, comment loading, profile loading, notification loading, and timesheet loading within a reasonable time under normal usage.

At the target scale of 300+ concurrent users, \"reasonable time\" shall mean a server-side response time (excluding network and client rendering) of under 300ms at the 95th percentile and under 800ms at the 99th percentile for the listed common requests under normal usage. The system shall sustain at least 50 requests per second of this traffic class without breaching these thresholds, with capacity for organic growth beyond 300 users handled through the horizontal scaling provisions in NFR-35 rather than by relaxing this SLA.

Complex operations such as report generation and large data filtering may take longer but should provide clear loading feedback to the user.

#### NFR-11: Dashboard Performance

Dashboard data shall be aggregated on the backend before being sent to the frontend.

The system shall avoid sending large raw datasets to the browser for frontend-side aggregation. This requirement is important for Admin and Manager dashboards because they display statistics, charts, task summaries, timesheet data, and performance metrics.

#### NFR-12: Kanban Board Performance

The Kanban board shall support smooth task rendering and drag-and-drop interaction.

The system shall store task order using a stable `order_index` value. Reordering tasks should not require recalculating the entire task list whenever possible.

#### NFR-13: Timesheet Performance

Timesheet creation, update, and deletion shall be processed using efficient backend validation.

The system shall check time lock status and daily total hours before committing log work changes.

The system shall avoid slow full-table scans by using proper indexing and filtering by user, task, work date, month, and year.

#### NFR-14: Report Export Performance

Report export operations shall be handled efficiently and should not block normal system usage.

If report generation requires longer processing time, the system should provide progress feedback or process the export asynchronously.

Generated report files shall be temporary outputs and shall not modify core business data.

#### NFR-15: Notification Delivery Performance

Realtime notifications should be delivered to online users with minimal delay.

The system shall persist notifications in the database so that users who are offline can still view missed notifications later.

Email notifications should be processed asynchronously where possible to avoid slowing down task, comment, review, or timesheet operations.

### 4. Reliability Requirements

#### NFR-16: Reliable Timesheet Recording

The system shall ensure that log work records are saved accurately and consistently.

When a user logs work hours, the system shall validate the related task, user permission, time lock status, and daily total hours before saving the record.

#### NFR-17: 24-Hour Daily Limit Reliability

The system shall reliably prevent a user from logging more than 24 hours in a single day.

This rule shall be enforced even when multiple requests are submitted at nearly the same time.

The system shall enforce this rule using a row-level lock: within the same PostgreSQL transaction that creates, updates, or deletes a log work record, the corresponding `daily_user_timesheets` row for that user and work date shall be read using `SELECT ... FOR UPDATE`, so concurrent requests for the same user and date are serialized at the database level rather than racing to read a stale total. The 24-hour total shall be recalculated and validated only after this lock is acquired, consistent with the transaction sequence defined in FR-60.

#### NFR-18: Time Lock Reliability

When a timesheet period is locked, the system shall reliably reject all create, update, and delete operations for log work records within that locked period.

This rule shall be enforced at backend level and should not depend only on frontend validation.

The lock-status check against `time_locks` and the row-level lock on the affected `daily_user_timesheets` row (per NFR-17, via `SELECT ... FOR UPDATE`) shall both occur within the same database transaction as the log work write, so that a period cannot be locked by a Manager or Admin in the gap between the lock check and the commit of an in-flight log work request.

#### NFR-19: Notification Reliability

The system shall not rely only on realtime WebSocket delivery.

All important notifications shall be persisted in the `notifications` table so users can view them even after disconnection, logout, browser close, or temporary network interruption.

#### NFR-20: Email Delivery Reliability

The system shall track email sending status when email notification tracking is required.

If an email fails due to temporary network or SMTP issues, the system should allow retry handling through a background task mechanism.

#### NFR-21: File Upload Reliability

When a file is uploaded, the system shall ensure consistency between physical file storage and database metadata.

If file storage fails, the system shall not create invalid attachment metadata. If metadata saving fails after file upload, the system should handle cleanup or mark the upload as failed.

### 5. Data Integrity Requirements

#### NFR-22: Referential Integrity

The system shall maintain referential integrity between related database tables.

Jobs must reference valid clients and managers. Tasks must reference valid jobs, assignees, and creators. Log work records must reference valid tasks and users. Attachments, comments, followers, notifications, and audit logs must maintain valid relationships according to database constraints.

#### NFR-23: Unique Constraint Integrity

This includes user email, role code, permission code, department name, client tax code, role-permission mapping, task follower mapping, and time lock period (unique per month, year, lock_scope, and job_id --- see FR-66).

#### NFR-24: Soft Delete Integrity

The system shall use soft delete or deactivation for business entities that must preserve historical traceability.

User accounts and clients shall not be physically deleted during normal business operations if their historical data is still needed.

#### NFR-25: Audit Data Integrity

Audit logs shall preserve key information about sensitive operations.

Each audit log should record the actor, action, affected table, affected record ID, old values, new values, IP address, and timestamp.

Audit records shall remain available for investigation even if a related user account is later inactive or unavailable.

#### NFR-26: Decimal Accuracy for Work Hours

The system shall use decimal-based numeric storage for work hours.

The system shall avoid floating-point types for work hour calculation because timesheet totals require accurate decimal calculation.

#### NFR-27: Transaction Consistency

Operations that affect multiple related records shall be executed in a transaction.

For example, creating or updating log work shall update both the detailed log work record and the daily total timesheet record consistently. If any step fails, the entire transaction shall be rolled back.

### 6. Availability Requirements

#### NFR-28: System Availability

The system should be available during normal business hours for Admin, Manager, and Employee users.

Users should be able to access task management, timesheet logging, dashboard, notification, and profile functions without frequent downtime.

#### NFR-29: Graceful Degradation

If a non-critical external service is temporarily unavailable, the system should degrade gracefully.

For example, if Email Service is temporarily unavailable, core operations such as task update or comment creation should still be completed, while the email notification can be retried later.

If Realtime Gateway is unavailable, notifications should still be saved in the database.

#### NFR-30: Service Failure Handling

The system shall handle failures from Email Service, File Storage Service, Redis, or WebSocket Gateway with clear error messages and proper fallback behavior.

A failure in one infrastructure service shall not corrupt core business data.

### 7. Scalability Requirements

#### NFR-31: Scalable Database Design

The database shall support growth in users, jobs, tasks, comments, notifications, log work records, and audit logs.

Large tables such as `log_works`, `notifications`, and `audit_logs` should be designed with appropriate indexes and long-term storage strategy.

#### NFR-32: Scalable Audit Log Storage

The audit log table may grow quickly because sensitive operations are recorded continuously.

The system should support a scalable audit log storage strategy, such as indexing by timestamp and partitioning by time period when the dataset becomes large.

#### NFR-33: Scalable Notification Processing

Notification processing shall support both realtime delivery and persisted notification history.

The system should use Redis, background workers, or equivalent mechanisms to prevent notification processing from slowing down user-facing operations.

#### NFR-34: Scalable Report Processing

The reporting module shall be able to process larger datasets as the number of users, tasks, and timesheet records grows.

Heavy report export operations should be optimized using backend aggregation, filtering, pagination, and asynchronous processing when needed.

#### NFR-35: Horizontal Scalability Readiness

The system architecture should allow future horizontal scaling of backend application instances, background workers, Redis, and database resources if business load increases.

The system shall be designed for an initial target of 300+ total users, with backend application instances and background workers (Celery) stateless and horizontally scalable behind a load balancer so that this user base can be served by adding instances rather than by vertical scaling alone. The authentication middleware\'s reliance on Redis for the per-request active-status check (NFR-04) and on a shared PostgreSQL instance for row-level locking (NFR-17, NFR-18) shall remain correct under multiple backend instances, since these mechanisms are centralized in Redis and the database rather than in per-instance memory.

### 8. Usability Requirements

#### NFR-36: Role-Oriented User Interface

The system interface shall be organized according to user role.

Admin, Manager, and Employee users shall see only the functions relevant to their responsibilities.

This reduces confusion and prevents users from attempting unauthorized actions.

#### NFR-37: Clear Navigation

The system shall provide clear navigation for major modules, including dashboard, clients, jobs, tasks, timesheets, reports, notifications, audit logs, and profile.

The menu structure shall remain consistent across pages within the same role environment.

#### NFR-38: Form Validation Feedback

The system shall provide immediate and understandable validation feedback for user input.

Validation errors should clearly explain what is wrong, such as invalid email, missing required field, task deadline exceeding job deadline, locked timesheet period, or daily work hours exceeding 24 hours.

#### NFR-39: Loading and Error States

The system shall provide visible loading states during API requests, file uploads, report exports, and form submissions.

The system shall display clear error messages when an operation fails.

#### NFR-40: Dashboard Readability

Charts, cards, tables, and metrics shall be presented in a readable and professional layout.

Admin dashboards shall focus on global metrics. Manager dashboards shall focus on team and job metrics. Employee dashboards shall focus on personal tasks and personal performance.

#### NFR-41: Kanban Usability

The Kanban interface shall be easy to use for task tracking.

Task cards shall display important information such as title, priority, status, deadline, assignee, and review state.

Drag-and-drop behavior shall be visually clear and should not cause accidental data loss.

### 9. Maintainability Requirements

#### NFR-42: Modular Architecture

The backend shall be organized into clear modules according to business domains, such as authentication, users, clients, jobs, tasks, timesheets, notifications, reports, profiles, and audit logs.

The frontend shall be organized into reusable components, layouts, pages, hooks, services, and state management modules.

#### NFR-43: Separation of Concerns

The system shall separate business logic, API handling, database access, validation, authentication, authorization, and presentation logic.

This improves readability, testing, debugging, and future extension.

#### NFR-44: Reusable UI Components

The frontend should use reusable components for forms, tables, modals, drawers, cards, charts, filters, and buttons.

This helps keep the user interface consistent across Admin, Manager, and Employee environments.

#### NFR-45: Clear Naming Convention

The system shall use consistent naming conventions for database tables, API routes, frontend components, variables, functions, and permission codes.

Names should clearly describe their purpose and business meaning.

#### NFR-46: Code Documentation

Important modules, complex business logic, database constraints, permission checks, transaction handling, and report generation logic should be documented in the source code or technical documentation.

#### NFR-47: Extensibility

The system shall be designed so that future features can be added without major restructuring.

Potential future extensions may include advanced payroll integration, advanced HR modules, mobile application support, advanced analytics, or additional notification channels.

### 10. Compatibility Requirements

#### NFR-48: Browser Compatibility

The system shall support modern web browsers such as Google Chrome, Microsoft Edge, Firefox, and Safari.

The user interface shall be tested on common desktop browser environments.

#### NFR-49: Responsive Layout

The system interface should support responsive layouts for different screen sizes.

The main target environment is desktop or laptop because Admin, Manager, and reporting workflows require tables, dashboards, and Kanban boards. However, basic viewing and simple actions should remain usable on tablet-sized screens.

#### NFR-50: API Compatibility

The frontend and backend shall communicate through stable REST API contracts.

API responses should follow consistent structure for success, validation error, forbidden access, not found, and server error cases.

### 11. Backup and Recovery Requirements

#### NFR-51: Database Backup

The system should support regular database backup for important business data.

Backup should include users, roles, permissions, departments, clients, jobs, tasks, comments, attachments metadata, log work records, daily timesheet totals, notifications, time locks, and audit logs.

#### NFR-52: Recovery from Data Loss

The system should allow restoration from backup in case of database failure, accidental data corruption, or infrastructure incident.

Recovery procedures should prioritize critical business data such as users, tasks, timesheets, time locks, and audit logs.

#### NFR-53: File Backup Consideration

Files stored through the File Storage Service, such as avatars and task attachments, should be included in backup or storage redundancy planning.

The database only stores file metadata and URLs, so file storage must be protected separately.

### 12. Observability and Logging Requirements

#### NFR-54: Application Error Logging

The system shall log backend errors for debugging and maintenance.

Error logs should include useful technical information such as endpoint, timestamp, error type, and request context where appropriate.

Sensitive information such as passwords, tokens, and confidential user data shall not be written into logs.

#### NFR-55: API Monitoring

The system should support monitoring of API response time, error rate, failed login attempts, report export failures, email sending failures, and WebSocket connection issues.

#### NFR-56: Background Task Monitoring

Background jobs such as email notification sending, report processing, or scheduled cleanup should be monitored.

Failures should be visible to administrators or maintainers.

#### NFR-57: Audit Log Separation

Application error logs and business audit logs shall be treated separately.

Application logs are used for technical debugging. Audit logs are used for business traceability, compliance, and responsibility tracking.

### 13. Compliance and Auditability Requirements

#### NFR-58: Traceability of Sensitive Actions

The system shall provide traceability for sensitive business actions.

Admin shall be able to review who performed an action, what data was changed, when it happened, and from which IP address the request was made.

#### NFR-59: Historical Data Preservation

The system shall preserve important historical data, especially task history, log work records, comments, time locks, notifications, and audit logs.

This is necessary for accountability, dispute resolution, performance evaluation, and operational review.

#### NFR-60: Read-Only Reporting Discipline

Reporting and analytics processes shall not modify business data.

Reports shall be generated from existing records and returned as temporary output files.

### 14. Integration Requirements

#### NFR-61: Email Service Integration Quality

The system shall integrate with SMTP or another configured Email Service for password reset and notification emails.

Email failure shall not corrupt the related business operation.

#### NFR-62: File Storage Integration Quality

The system shall integrate with a file storage mechanism for avatars and task attachments.

The system shall store file metadata in the database and actual file content in file storage.

#### NFR-63: Redis and WebSocket Integration Quality

The system shall use Redis and WebSocket infrastructure to support realtime notification behavior.

The system shall still persist notification records in the database so that notification history is not lost when realtime delivery fails.

### 15. System Constraints

#### NFR-64: Technology Stack Constraint

The system shall be implemented using the selected project technology stack:

-   Frontend: React Vite, TypeScript, React Router DOM, Zustand, React Hook Form, Zod, TanStack Table, Shadcn UI, Recharts or Chart.js, and DnD Kit.
-   Backend: Django, Django REST Framework, Django Simple JWT, Django Channels, and Celery.
-   Database and Infrastructure: PostgreSQL, Redis, WebSocket, and SMTP Email Service.
-   Supporting Tools: Git, GitHub, Postman, Docker if needed, and Visual Studio Code.

#### NFR-65: Client-Server Architecture Constraint

The system shall follow a Client-Server architecture.

The frontend shall handle user interaction and presentation. The backend shall handle authentication, authorization, validation, business logic, database transactions, reporting, notification processing, and audit logging.

#### NFR-66: Relational Database Constraint

The system shall use PostgreSQL as the primary relational database.

Core business data shall be stored in normalized relational tables with appropriate primary keys, foreign keys, indexes, unique constraints, and check constraints.

### 16. Non-Functional Requirement Summary

The WorkTracker system shall satisfy the following quality goals:

-   Secure authentication and permission control.
-   Reliable role-based access isolation.
-   Accurate and consistent timesheet processing.
-   Strong data integrity through relational constraints and backend validation.
-   Stable realtime notification with persisted notification history.
-   Efficient dashboard and report generation.
-   Maintainable modular codebase.
-   Professional and role-oriented user experience.
-   Preserved audit history for accountability.
-   Scalable handling of growing tasks, timesheets, notifications, and audit logs.

These non-functional requirements ensure that WorkTracker is not only functionally complete but also secure, reliable, maintainable, and suitable for a professional internal work management environment.

## 2.6 Business Rules

Business rules define the operational rules that the WorkTracker system must follow. These rules are not individual screen functions. They are business-level constraints that ensure the system behaves correctly and consistently.

The following business rules are considered core rules for the WorkTracker system.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Rule ID                             Business Rule
  ----------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  BR-01                               Each user must be assigned to exactly one role in the system.

  BR-02                               A user email must be unique and must be used as the main login identifier.

  BR-03                               An inactive or locked user account must not be allowed to log in or access protected system functions.

  BR-04                               Only Admin or authorized users may create, update, lock, unlock, or deactivate user accounts.

  BR-05                               System access must be controlled by role and permission. A user may only perform actions allowed by the assigned role and permissions.

  BR-06                               A client tax code must be unique to prevent duplicate client records.

  BR-07                               A client should not be physically deleted during normal business operation. If a client is no longer active, the system should deactivate the client instead.

  BR-08                               A job must belong to one valid client. A job must not be created under a non-existing client.

  BR-09                               A job must be assigned to one valid manager. A job should not exist without a responsible manager.

  BR-10                               A job deadline must not be earlier than its start date.

  BR-11                               A task must belong to one valid job. A task must not exist independently outside a job. A task must not be created under a job with status COMPLETED or CANCELLED..

  BR-12                               A task must have one creator and one assignee. The creator is normally the Manager who creates the task, and the assignee is the Employee responsible for execution.

  BR-13                               A task deadline must not exceed the deadline of its parent job.

  BR-14                               An Employee may update task progress according to permitted workflow transitions, but an Employee must not directly approve a task as completed if Manager approval is required.

  BR-15                               Only Manager or authorized users may approve or reject a task submitted for review.

  BR-16                      If a task is rejected, the rejection reason must be recorded as a task comment with comment_type = REJECTION_NOTE, for traceability and to distinguish it from normal discussion comments.

  BR-17                               A user must not be added as a follower of the same task more than once.

  BR-18                               An Employee may only log work hours for tasks that the Employee is allowed to access.

  BR-19                               A user must not log more than 24 total work hours in a single day.

  BR-20                               When log work is created, updated, corrected, rejected, or voided, the related daily total timesheet must be updated consistently.

  BR-21                               If a timesheet period is locked, users must not be allowed to create, update, or delete log work records within that period.

  BR-22                               A timesheet lock must be unique according to its lock scope. A JOB-scoped lock must be unique by lock_month, lock_year, and job_id. A GLOBAL-scoped lock must be unique by lock_month and lock_year, with job_id = NULL, and may only be created by Admin. Because PostgreSQL does not treat NULL values as equal in ordinary unique constraints, GLOBAL and JOB lock uniqueness must be enforced using separate partial unique constraints.

  BR-23                               Important task events, such as assignment, comment, review submission, approval, rejection, and attachment upload, should generate notifications for related users.

  BR-24                               Sensitive actions must be recorded in audit logs. Sensitive actions include user changes, permission changes, client changes, job changes, task workflow changes, timesheet lock changes, report exports, and profile updates.

  BR-25                               Audit logs must preserve historical traceability even if a related user account later becomes inactive or unavailable.

  BR-26                      A Manager\'s access scope (which jobs, tasks, employees, timesheets, and reports the Manager may view or modify) is determined exclusively by jobs.manager_id. Department-level manager assignment (departments.manager_id) is an organizational/directory attribute and does not grant or imply access scope.

  BR-27                      A log work entry must not have a work_date later than the current date, and must not be created or updated against a task or job whose status is Cancelled. Logging against a Completed task/job is allowed only if explicitly enabled by configuration; this restriction does not apply to deleting an existing log work entry.

  BR-28                      Action-level authorization (RBAC: does the role allow this kind of action) and row-level/scope authorization (does this specific record belong to this user\'s scope) are independent and both mandatory. Passing the RBAC permission check alone must never be treated as sufficient to authorize access to a specific record.

  BR-29                      Tasks are flat: each task belongs to exactly one job and has no parent task and no child tasks. Task dependency relationships and subtasks or checklist items are not supported in the current version.

  BR-30                      A notification\'s event_type (the business event that triggered it) and type (the delivery channel used) are independent classifications and must not be conflated; filtering and routing must use event_type, not type.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

These business rules are mandatory because they protect system consistency, prevent invalid operations, preserve historical data, and support accountability.

## 2.7 Assumptions and Constraints

This section defines the assumptions and constraints that affect the design and implementation of the WorkTracker system.

### 2.7.1 Assumptions

The following assumptions are made for the WorkTracker system:

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Assumption ID                       Assumption
  ----------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------
  AS-01                               The system is designed for internal organizational use, not for public customer-facing commercial service.

  AS-02                               The organization has three main user groups: Admin, Manager, and Employee.

  AS-03                               Each user has a valid email address for login and password reset.

  AS-04                               Each active user belongs to a valid role.

  AS-05                      Managers are responsible for coordinating jobs, tasks, and timesheets within their authorized scope, defined exclusively by jobs.manager_id.

  AS-06                               Employees log work hours honestly, but the system still validates all timesheet data at backend and database level.

  AS-07                               The organization wants to preserve task history, log work history, and audit history even when users or clients are no longer active.

  AS-08                               The system will be accessed mainly through modern web browsers on desktop or laptop devices.

  AS-09                               Realtime notification is useful but must not be the only notification storage mechanism. Notifications should also be stored in the database.

  AS-10                               Report generation is based on existing business data and should not modify core business records.

  AS-11                               The system will use PostgreSQL as the primary relational database.

  AS-12                               The system will use Redis to support caching, realtime communication, token-related handling, and background processing where required.

  AS-13                               Email sending depends on an external SMTP Email Service.

  AS-14                               File upload depends on an internal or external File Storage Service.

  AS-15                               The current project scope does not include payroll, accounting, finance management, advanced HR management, or mobile application development.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 2.7.2 System Constraints

The following constraints must be considered during system design and implementation:

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Constraint ID                       Constraint
  ----------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  CS-01                               The system must follow a Client-Server architecture.

  CS-02                               The frontend must be implemented using React Vite and TypeScript.

  CS-03                               The backend must be implemented using Django and Django REST Framework.

  CS-04                               JWT authentication must be implemented using Django Simple JWT or an equivalent JWT mechanism.

  CS-05                               Role-based access control must be enforced at backend level. Frontend route protection alone is not sufficient.

  CS-06                               The primary database must be PostgreSQL.

  CS-07                               Core business data must be stored in relational tables with primary keys, foreign keys, indexes, unique constraints, and appropriate delete rules.

  CS-08                               Passwords must not be stored in plain text. Passwords must be stored using secure hashing.

  CS-09                               User account history, task history, log work history, and audit history must not be lost when an account is locked or deactivated.

  CS-10                               The time_locks table supports both system-wide (GLOBAL) and per-job (JOB) locking via the lock_scope and job_id fields. A GLOBAL lock may only be created by Admin; a JOB lock may be created by the Manager who owns that job (jobs.manager_id), allowing different jobs under the same Manager to be locked independently as each job\'s timesheet period is reviewed and closed.

  CS-11                               The daily total logged hours must not exceed 24 hours per user per day.

  CS-12                               Task ordering on the Kanban board must use `order_index` based on the current database design.

  CS-13                               Report generation must be treated as a read-only process and must not directly modify business data.

  CS-14                               File content should be stored through File Storage Service, while the database stores only file metadata and file URL.

  CS-15                               Audit logs must be protected from unauthorized access. Only Admin or explicitly authorized users may view audit logs.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 2.7.3 Business Scope Constraints

The WorkTracker system is limited to internal work management and time tracking. The following business areas are excluded from the current scope:

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  Excluded Area                             Reason
  ----------------------------------------- ---------------------------------------------------------------------------------------------------------------------
  Payroll Processing                        The system records work hours but does not calculate salary or payroll.

  Accounting Management                     The system does not manage invoices, payments, expenses, or financial transactions.

  Advanced Human Resource Management        The system stores basic employee profile data but does not manage recruitment, benefits, contracts, or HR policies.

  Mobile Application                        The current project focuses on a web application.

  External Project Management Integration   The system does not currently integrate with external tools such as Jira, Trello, Asana, or Microsoft Project.

  AI-Based Prediction                       The system does not include AI-based task prediction, productivity prediction, or automatic scheduling.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------

### 2.7.4 Technical Dependency Constraints

The system depends on several supporting technologies and services.

  --------------------------------------------------------------------------------------------------------------------------------
  Dependency                          Constraint
  ----------------------------------- --------------------------------------------------------------------------------------------
  PostgreSQL                          Required for persistent relational data storage.

  Redis                               Required for caching, realtime support, and background task coordination where applicable.

  SMTP Email Service                  Required for password reset email and email notification delivery.

  WebSocket / Realtime Gateway        Required for realtime notification delivery.

  File Storage Service                Required for avatar and task attachment storage.

  Browser Environment                 Users must use a modern browser that supports the frontend application properly.
  --------------------------------------------------------------------------------------------------------------------------------

If one supporting service fails, the system should handle the failure gracefully. For example, if realtime notification delivery fails, the notification should still be stored in the database. If email sending fails, the core business operation should not be corrupted.
