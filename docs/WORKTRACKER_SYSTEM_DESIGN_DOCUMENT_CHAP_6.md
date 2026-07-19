# CHAPTER 6: DATA DICTIONARY

## 6.1 Database Overview

The WorkTracker system uses a relational database to store and manage structured business data. The database is designed to support authentication, authorization, client management, job management, task management, timesheet tracking, time lock control, notification management, file attachment management, profile management, and audit logging.

The database is organized into several logical groups:

1.  **Authorization Group**\
    This group manages authentication and role-based access control. It includes `roles`, `permissions`, `role_permissions`, `users`, and `password_resets`.

2.  **Admin Management Group**\
    This group supports system administration, department management, client management, job management, time lock control, and audit logging. It includes `departments`, `employee_profiles`, `clients`, `jobs`, `time_locks`, and `audit_logs`.

3.  **Manager and Task Management Group**\
    This group supports job coordination, task assignment, Kanban workflow, comments, followers, and task attachments. It includes `tasks`, `task_followers`, `task_comments`, and `task_attachments`.

4.  **Employee and Timesheet Group**\
    This group supports work execution and time tracking. It includes `log_works` and `daily_user_timesheets`.

5.  **Notification Group**\
    This group supports realtime and email-based notification handling. It includes `notifications`.

The database design applies the following principles:

-   Authentication data is separated from employee profile data.
-   Roles and permissions are separated to support flexible role-based access control.
-   Clients are treated as root business entities.
-   Jobs are linked to clients and managers; jobs.manager_id is the single canonical field used to compute Manager access scope. departments.manager_id is an organizational/directory attribute only and carries no access-control meaning.
-   Tasks are linked to jobs, assignees, and creators.
-   Action-level authorization (RBAC: roles, permissions, role_permissions) and row-level/scope authorization (ownership fields such as jobs.manager_id, tasks.assignee_id, log_works.user_id) are two independent, both-required mechanisms; passing the RBAC check alone never authorizes access to a specific record.
-   Timesheet records are controlled by time lock rules.
-   Daily total work hours are stored separately to prevent logging more than 24 hours per day.
-   Notifications are persisted in the database so that users can view notification history even if realtime delivery fails.
-   Audit logs are preserved for traceability and administrative review.
-   Important relationships are protected through primary keys, foreign keys, unique constraints, indexes, and delete rules.

## 6.2 Table List

The WorkTracker database contains the following main tables.

  -------------------------------------------------------------------------------------------------------------------------------------------
  Data Store ID     Database Table No.   Table Name              Description
  ----------------- -------------------- ----------------------- ----------------------------------------------------------------------------
  D1                Table 1              roles                   Stores system roles such as Admin, Manager, and Employee.

  D2                Table 2              permissions             Stores detailed permission codes used to protect sensitive system actions.

  D3                Table 3              role_permissions        Stores the many-to-many mapping between roles and permissions.

  D4                Table 4              users                   Stores core user account and authentication information.

  D5                Table 5              password_resets         Stores one-time password reset tokens.

  D6                Table 6              departments             Stores department or team information.

  D7                Table 7              employee_profiles       Stores personal profile information of users.

  D8                Table 8              clients                 Stores client or partner information.

  D9                Table 9              jobs                    Stores master jobs or projects linked to clients and managers.

  D10               Table 10             time_locks              Stores locked timesheet periods by month and year.

  D11               Table 11             audit_logs              Stores sensitive action history for audit and traceability.

  D12               Table 12             tasks                   Stores detailed work tasks under jobs.

  D13               Table 13             task_followers          Stores users who follow tasks and receive task-related notifications.

  D14               Table 14             task_comments           Stores task discussion and review comments.

  D15               Table 15             log_works               Stores detailed work hour records.

  D16               Table 15B            daily_user_timesheets   Stores total daily work hours per user.

  D17               Table 16             notifications           Stores realtime and email notification records.

  D18               Table 17             task_attachments        Stores metadata of files attached to tasks.
  -------------------------------------------------------------------------------------------------------------------------------------------

## 6.3 Table Details

### 6.3.1 roles

The `roles` table stores user role definitions. It separates role information from the `users` table so that roles can be managed independently.

  -----------------------------------------------------------------------
  Item                   Description
  ---------------------- ------------------------------------------------
  Table name             roles

  Main purpose           Store system role definitions.

  Related module         Authentication and Authorization

  Main users             Admin

  Main relationship      One role can be assigned to many users.

  Example values         ADMIN, MANAGER, EMPLOYEE
  -----------------------------------------------------------------------

### 6.3.2 permissions

The `permissions` table stores detailed permission records. Each permission represents a protected action in the backend system.

  --------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- --------------------------------------------------------------------------
  Table name                          permissions

  Main purpose                        Store permission definitions.

  Related module                      RBAC / Security

  Main users                          Admin

  Main relationship                   One permission can be assigned to many roles through `role_permissions`.

  Example values                      client:create, job:lock, task:assign, timesheet:log
  --------------------------------------------------------------------------------------------------------------

### 6.3.3 role_permissions

The `role_permissions` table is a junction table between `roles` and `permissions`. It supports a many-to-many relationship.

  ------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ------------------------------------------------------------------
  Table name                          role_permissions

  Main purpose                        Map roles to permissions.

  Related module                      RBAC / Security

  Main users                          Admin

  Main relationship                   Many-to-many relationship between roles and permissions.

  Special rule                        The same permission must not be assigned twice to the same role.
  ------------------------------------------------------------------------------------------------------

### 6.3.4 users

The `users` table stores core user account data. It is optimized for authentication and authorization by storing only essential account fields.

  --------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- --------------------------------------------------------------------
  Table name                          users

  Main purpose                        Store login, password, role, and account status data.

  Related module                      Authentication and User Management

  Main users                          Admin, Manager, Employee

  Main relationship                   Each user belongs to one role.

  Special rule                        Personal profile data is stored separately in `employee_profiles`.
  --------------------------------------------------------------------------------------------------------

### 6.3.5 password_resets

The `password_resets` table stores password reset tokens for the Forgot Password and Reset Password workflows.

  ---------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ---------------------------------------------------------
  Table name                          password_resets

  Main purpose                        Store one-time password reset tokens.

  Related module                      Authentication

  Main users                          Admin, Manager, Employee

  Main relationship                   Token is associated with an email address.

  Special rule                        Each token must be unique and should be used only once.
  ---------------------------------------------------------------------------------------------

### 6.3.6 departments

The `departments` table stores department or team information.

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name                          departments

  Main purpose                        Store department or team information.

  Related module                      User and Department Management

  Main users                          Admin, Manager

  Main relationship                   One department can contain many employee profiles.

  Special rule                        If the manager is removed, the department can still exist because manager_id may be set to NULL. This field is a directory/organizational attribute only --- it is NOT used to compute Manager access scope. Manager access scope is determined exclusively by jobs.manager_id (see 6.3.9).
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.7 employee_profiles

The `employee_profiles` table stores personal information of users. It is separated from the `users` table to keep authentication data lightweight.

  -----------------------------------------------------------------------
  Item                  Description
  --------------------- -------------------------------------------------
  Table name            employee_profiles

  Main purpose          Store employee personal profile information.

  Related module        Profile Management

  Main users            Admin, Manager, Employee

  Main relationship     One user has one employee profile.

  Special rule          `user_id` is both primary key and foreign key.
  -----------------------------------------------------------------------

### 6.3.8 clients

The `clients` table stores client or partner information. It is a root business entity for jobs.

  --------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- --------------------------------------------------------------
  Table name                          clients

  Main purpose                        Store client or partner information.

  Related module                      Client Management

  Main users                          Admin

  Main relationship                   One client can have many jobs.

  Special rule                        Clients should be deactivated instead of physically deleted.
  --------------------------------------------------------------------------------------------------

### 6.3.9 jobs

The `jobs` table stores master jobs or projects. Each job belongs to a client and is managed by a responsible manager.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name                          jobs

  Main purpose                        Store master job or project information.

  Related module                      Job Management

  Main users                          Admin, Manager

  Main relationship                   One job belongs to one client and one manager.

  Special rule                        Backend logic must ensure that a job is not created under an inactive client. jobs.manager_id is the single canonical field used to compute Manager access scope across the entire system (jobs, tasks, timesheets, reports). No other table or field, including departments.manager_id, shall be used for this purpose.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.10 time_locks

The `time_locks` table stores timesheet lock configuration by month and year.

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name                          time_locks

  Main purpose                        Lock or unlock timesheet periods.

  Related module                      Timesheet and Time Lock Management

  Main users                          Admin, Manager

  Main relationship                   `locked_by` references the user who locked the period.

  Special rule                        A lock record is unique by (lock_month, lock_year, lock_scope, job_id). A JOB-scoped lock (lock_scope = JOB) restricts log work only for tasks belonging to that specific job, allowing a Manager to lock different jobs independently as each is completed. A GLOBAL-scoped lock (lock_scope = GLOBAL, job_id = NULL) restricts the entire system for that period and may only be created by Admin.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.11 audit_logs

The `audit_logs` table stores sensitive action history for system monitoring and traceability.

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name                          audit_logs

  Main purpose                        Store audit trail of sensitive system actions.

  Related module                      Audit Logging

  Main users                          Admin

  Main relationship                   Each audit log may reference the user who performed the action.

  Special rule                        Audit logs should remain available even if the related user becomes unavailable. ip_address is nullable, since some sensitive actions (e.g. background/system-triggered actions) may not have a request IP available; absence of an IP must not block audit log creation.
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.12 tasks

The `tasks` table stores detailed work tasks. It is the central table for Kanban workflow and task execution.

  --------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- --------------------------------------------------------------
  Table name                          tasks

  Main purpose                        Store task information.

  Related module                      Task and Kanban Management

  Main users                          Manager, Employee

  Main relationship                   Each task belongs to one job, one assignee, and one creator.

  Special rule                        `order_index` is used to support Kanban ordering.
  --------------------------------------------------------------------------------------------------

### 6.3.13 task_followers

The `task_followers` table stores users who follow a task and receive task-related notifications.

  -------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -------------------------------------------------------------
  Table name                          task_followers

  Main purpose                        Store task follower relationships.

  Related module                      Task Notification

  Main users                          Manager, Employee

  Main relationship                   Many-to-many relationship between users and tasks.

  Special rule                        The same user must not follow the same task more than once.
  -------------------------------------------------------------------------------------------------

### 6.3.14 task_comments

The `task_comments` table stores comments and discussion history for tasks.

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                Description
  ------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name          task_comments

  Main purpose        Store task comments and review notes.

  Related module      Task Collaboration

  Main users          Manager, Employee

  Main relationship   Each comment belongs to one task and one user.

  Special rule        Comments preserve task discussion and review history. comment_type distinguishes normal discussion comments from Manager rejection notes, so the UI and reporting can filter or render them differently.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.15 log_works

The `log_works` table stores detailed work hour records for users and tasks.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------------------------------------------------------------------------------------------------------
  Table name                          log_works

  Main purpose                        Store detailed timesheet entries.

  Related module                      Timesheet Management

  Main users                          Employee, Manager

  Main relationship                   Each log work record belongs to one task and one user.

  Special rule                        Log work must respect time lock and daily total hour rules.
                                      
                                      Log work records are never physically deleted; removal is represented by review_status = VOIDED to preserve traceability (CS-09).
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.16 daily_user_timesheets

The `daily_user_timesheets` table stores total work hours per user per day.

  -----------------------------------------------------------------------
  Item                Description
  ------------------- ---------------------------------------------------
  Table name          daily_user_timesheets

  Main purpose        Store daily total logged hours per user.

  Related module      Timesheet Validation

  Main users          System, Employee, Manager

  Main relationship   Each row belongs to one user and one work date.

  Special rule        Total hours must not exceed 24 hours per day.
  -----------------------------------------------------------------------

### 6.3.17 notifications

The `notifications` table stores notification records for realtime and email notification handling.

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table name                          notifications

  Main purpose                        Store notification history and email sending status.

  Related module                      Notification Management

  Main users                          Admin, Manager, Employee

  Main relationship                   Each notification belongs to one user.

  Special rule                        Notifications are persisted even if realtime delivery fails. event_type (what happened, e.g. TASK_ASSIGNED) and type (how it was delivered, e.g. EMAIL_ONLY) are independent fields and must not be conflated.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.3.18 task_attachments

The `task_attachments` table stores metadata of files attached to tasks.

  ----------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ----------------------------------------------------------------------------------
  Table name                          task_attachments

  Main purpose                        Store file metadata for task attachments.

  Related module                      Task Attachment Management

  Main users                          Manager, Employee

  Main relationship                   Each attachment belongs to one task and one user.

  Special rule                        The database stores metadata and URL only; physical files are stored separately.
  ----------------------------------------------------------------------------------------------------------------------

## 6.4 Column Description

### 6.4.1 roles

  --------------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- --------------------------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique role identifier.

  code              VARCHAR(50)       NOT NULL, UNIQUE, INDEX       Role code used by backend logic, such as ADMIN, MANAGER, EMPLOYEE.

  name              VARCHAR(100)      NOT NULL                      Role display name shown on the user interface.

  description       VARCHAR(255)      NULL                          Description of the role and its responsibility.
  --------------------------------------------------------------------------------------------------------------------------------------

### 6.4.2 permissions

  --------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- --------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique permission identifier.

  code              VARCHAR(100)      NOT NULL, UNIQUE, INDEX       Permission code used to protect backend actions.

  name              VARCHAR(150)      NOT NULL                      Human-readable permission name.
  --------------------------------------------------------------------------------------------------------------------

### 6.4.3 role_permissions

  --------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key                       Description
  ----------------- ----------------- -------------------------------------- -----------------------------------------------------
  id       INT      PRIMARY KEY, AUTO_INCREMENT   Unique role-permission mapping identifier.

  role_id           INT               NOT NULL, FOREIGN KEY                  References `roles(id)`.

  permission_id     INT               NOT NULL, FOREIGN KEY                  References `permissions(id)`.
  --------------------------------------------------------------------------------------------------------------------------------

### 6.4.4 users

  ------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ------------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique user identifier.

  email             VARCHAR(155)      NOT NULL, UNIQUE, INDEX       Main login email of the user.

  password          VARCHAR(255)      NOT NULL                      Hashed password.

  role_id           INT               NOT NULL, FOREIGN KEY         References `roles(id)`.

  is_active         BOOLEAN           DEFAULT TRUE, INDEX           Account status used to allow or block system access.
  ------------------------------------------------------------------------------------------------------------------------

### 6.4.5 password_resets

  ----------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ----------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique password reset record identifier.

  email             VARCHAR(155)      NOT NULL, INDEX               Email address requesting password reset.

  token             VARCHAR(255)      NOT NULL, UNIQUE, INDEX       Secure one-time reset token.

  is_used           TINYINT(1)        DEFAULT 0                     Indicates whether the token has already been used.

  expires_at        DATETIME          NOT NULL                      Token expiration time.

  created_at        DATETIME          DEFAULT CURRENT_TIMESTAMP     Token creation time.
  ----------------------------------------------------------------------------------------------------------------------

### 6.4.6 departments

  ---------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ---------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique department identifier.

  manager_id        INT               NULL, FOREIGN KEY             References `users(id)` as the department manager.

  name              VARCHAR(100)      NOT NULL, UNIQUE              Department name.

  description       TEXT              NULL                          Department description.

  created_at        DATETIME          DEFAULT CURRENT_TIMESTAMP     Department creation time.
  ---------------------------------------------------------------------------------------------------------------------

### 6.4.7 employee_profiles

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key                                        Description
  ----------------- ----------------- ------------------------------------------------------- -------------------------------------------------------
  user_id           INT               PRIMARY KEY, FOREIGN KEY                                References `users(id)`. Also acts as the primary key.

  full_name         VARCHAR(150)      NOT NULL                                                Employee full name.

  phone_number      VARCHAR(20)       NULL                                                    Employee phone number.

  department_id     INT               NULL, FOREIGN KEY                                       References `departments(id)`.

  avatar_url        VARCHAR(500)      NULL                                                    URL of the employee avatar image.

  updated_at        DATETIME          DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP   Last profile update time.
  ---------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.8 clients

  ---------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ---------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique client identifier.

  client_name       VARCHAR(255)      NOT NULL                      Client or partner name.

  tax_code          VARCHAR(50)       NOT NULL, UNIQUE, INDEX       Client tax code.

  contact_person    VARCHAR(150)      NULL                          Main contact person.

  contact_email     VARCHAR(155)      NULL                          Contact email.

  contact_phone     VARCHAR(20)       NULL                          Contact phone number.

  is_active         TINYINT(1)        DEFAULT 1, INDEX              Client active status for soft delete.
  ---------------------------------------------------------------------------------------------------------

### 6.4.9 jobs

  --------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- --------------------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique job identifier.

  client_id         INT               NOT NULL, FOREIGN KEY         References `clients(id)`.

  manager_id        INT               NOT NULL, FOREIGN KEY         References `users(id)` as the responsible manager.

  job_name          VARCHAR(255)      NOT NULL                      Job or project name.

  description       TEXT              NULL                          Job description.

  start_date        DATE              NOT NULL                      Job start date.

  deadline          DATE              NOT NULL, INDEX               Job deadline.

  status            ENUM              DEFAULT 'PLANNING'            Job status: PLANNING, ACTIVE, COMPLETED, ON_HOLD, CANCELLED.

  created_at        DATETIME          DEFAULT CURRENT_TIMESTAMP     Job creation time.

  updated_at        DATETIME          DEFAULT CURRENT_TIMESTAMP     Last job update time.
  --------------------------------------------------------------------------------------------------------------------------------

### 6.4.10 time_locks

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name              Data Type             Constraint / Key                       Description
  ------------------------ --------------------- -------------------------------------- -----------------------------------------------------------------------------------------------------
  id              INT          PRIMARY KEY, AUTO_INCREMENT   Unique time lock identifier.

  lock_month      TINYINT      NOT NULL                      Locked month, from 1 to 12.

  lock_year       SMALLINT     NOT NULL                      Locked year.

  lock_scope      ENUM         NOT NULL, DEFAULT \'JOB\'     Scope of the lock: JOB (restricted to one specific job) or GLOBAL (system-wide, all jobs).

  job_id          INT          NULL, FOREIGN KEY             References jobs(id). Required when lock_scope = JOB; NULL when lock_scope = GLOBAL.

  is_locked       TINYINT(1)   DEFAULT 1                     Indicates whether the period is locked.

  locked_by       INT          NOT NULL, FOREIGN KEY         References users(id) as the user who locked the period.

  locked_at       DATETIME     DEFAULT CURRENT_TIMESTAMP     Lock action time.

  lock_reason     TEXT         NULL                          Reason for locking the timesheet period.

  unlocked_by     INT          NULL, FOREIGN KEY             References users(id) as the user who last unlocked the period.

  unlocked_at     DATETIME     NULL                          Time when the period was last unlocked.

  unlock_reason   TEXT         NULL                          Reason for unlocking the timesheet period. Required when a locked period is unlocked.

  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP     Last time the lock record was changed.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.11 audit_logs

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key                   Description
  ----------------- ----------------- ---------------------------------- ----------------------------------------------------------------------------
  id                BIGINT            PRIMARY KEY, AUTO_INCREMENT        Unique audit log identifier. BIGINT is used for large log volume.

  user_id           INT               NULL, FOREIGN KEY                  References `users(id)`. May be NULL if the referenced user is unavailable.

  action            VARCHAR(50)       NOT NULL                           Action name, such as CREATE_JOB, SOFT_DELETE_CLIENT, or LOCK_TIMESHEET.

  table_name        VARCHAR(50)       NOT NULL                           Name of the affected table.

  record_id         INT               NOT NULL                           ID of the affected record.

  old_values        JSON              NULL                               Data before the change.

  new_values        JSON              NULL                               Data after the change.

  ip_address        VARCHAR(45)       NULL                      IP address of the actor, when available from the request context.

  created_at        DATETIME          DEFAULT CURRENT_TIMESTAMP, INDEX   Audit log creation time.
  ---------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.12 tasks

  ------------------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ------------------------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique task identifier.

  job_id            INT               NOT NULL, FOREIGN KEY         References `jobs(id)`.

  assignee_id       INT               NOT NULL, FOREIGN KEY         References `users(id)` as the assigned employee.

  creator_id        INT               NOT NULL, FOREIGN KEY         References `users(id)` as the task creator.

  title             VARCHAR(255)      NOT NULL                      Task title.

  description       TEXT              NULL                          Task description.

  priority          ENUM              DEFAULT 'MEDIUM', INDEX       Task priority: LOW, MEDIUM, HIGH.

  status            ENUM              DEFAULT 'TODO', INDEX         Task status: TODO, IN_PROGRESS, REVIEWING, COMPLETED, CANCELLED.

  deadline          DATE              NOT NULL, INDEX               Task deadline.

  completed_at      DATETIME          NULL                          Completion time when the task is approved as completed.

  order_index       VARCHAR(255)      NOT NULL, INDEX               String-based ordering value for Kanban drag-and-drop.

  created_at        DATETIME          Not specified                 Task creation time.

  updated_at        DATETIME          Not specified                 Last task update time.
  ------------------------------------------------------------------------------------------------------------------------------------

### 6.4.13 task_followers

  ------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- ------------------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique follower record identifier.

  task_id           INT               NOT NULL, FOREIGN KEY         References `tasks(id)`.

  user_id           INT               NOT NULL, FOREIGN KEY         References `users(id)`.

  joined_at         DATETIME          DEFAULT CURRENT_TIMESTAMP     Time when the user started following the task.
  ------------------------------------------------------------------------------------------------------------------

### 6.4.14 task_comments

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name             Data Type         Constraint / Key                        Description
  ----------------------- ----------------- --------------------------------------- -------------------------------------------------------------------------------------------------------------------
  id                      INT               PRIMARY KEY, AUTO_INCREMENT             Unique comment identifier.

  task_id                 INT               NOT NULL, FOREIGN KEY                   References `tasks(id)`.

  user_id                 INT               NOT NULL, FOREIGN KEY                   References users(id) as the comment author

  content                 TEXT              NOT NULL                                Comment content.

  comment_type   ENUM     NOT NULL, DEFAULT \'NORMAL\'   Distinguishes comment purpose: NORMAL (regular discussion) or REJECTION_NOTE (Manager rejection reason).

  created_at              DATETIME          DEFAULT CURRENT_TIMESTAMP, INDEX        Comment creation time.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.15 log_works

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name                  Data Type           Constraint / Key                                Description
  ---------------------------- ------------------- ----------------------------------------------- ----------------------------------------------------------------------------------------
  id                           BIGINT              PRIMARY KEY, AUTO_INCREMENT                     Unique log work identifier. BIGINT is used because timesheet records may grow quickly.

  task_id                      INT                 NOT NULL, FOREIGN KEY                           References `tasks(id)`.

  user_id                      INT                 NOT NULL, FOREIGN KEY                           References `users(id)`.

  work_date                    DATE                NOT NULL                                        Date when the work was performed.

  hours_spent                  DECIMAL(4,2)        NOT NULL                                        Number of hours spent on the task.

  description                  TEXT                NULL                                            Description of work performed.

  created_at                   DATETIME            DEFAULT CURRENT_TIMESTAMP                       Log creation time.

  updated_at                   DATETIME            DEFAULT CURRENT_TIMESTAMP                       Last log update time.

  review_status       ENUM       NOT NULL, DEFAULT \'PENDING\', INDEX   Review state of the log work entry: PENDING, APPROVED, REJECTED, VOIDED.

  reviewed_by         INT        NULL, FOREIGN KEY                      References users(id) as the Manager who reviewed this entry.

  reviewed_at         DATETIME   NULL                                   Time when the entry was reviewed.

  review_note         TEXT       NULL                                   Manager\'s note when approving or rejecting the entry.

  adjusted_by         INT        NULL, FOREIGN KEY                      References users(id) as the user who corrected or voided this entry.

  adjusted_at         DATETIME   NULL                                   Time when the entry was corrected or voided.

  adjustment_reason   TEXT       NULL                                   Reason for correction or voiding, required for audit traceability.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.16 daily_user_timesheets

  ------------------------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key                       Description
  ----------------- ----------------- -------------------------------------- ---------------------------------------------
  id       INT      PRIMARY KEY, AUTO_INCREMENT   References users(id).

  user_id           INT               NOT NULL, FOREIGN KEY                  References `users(id)`.

  work_date         DATE              NOT NULL                               Work date.

  total_hours       DECIMAL(4,2)      DEFAULT 0, CHECK total_hours \<= 24    Total logged hours of the user on the date.
  ------------------------------------------------------------------------------------------------------------------------

### 6.4.17 notifications

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Column Name           Data Type              Constraint / Key                   Description
  --------------------- ---------------------- ---------------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  id                    BIGINT                 PRIMARY KEY, AUTO_INCREMENT        Unique notification identifier.

  user_id               INT                    NOT NULL, INDEX, FOREIGN KEY       References `users(id)` as the notification receiver.

  event_type   VARCHAR(50)   NOT NULL, INDEX           Identifies the business event that triggered the notification: TASK_ASSIGNED, TASK_STATUS_CHANGED, TASK_COMMENT, TASK_SUBMITTED, TASK_APPROVED, TASK_REJECTED, TASK_ATTACHMENT, TIMESHEET_LOCK, TIMESHEET_UNLOCK, REPORT_EXPORTED, or ACCOUNT_OR_PERMISSION_CHANGED. Used for filtering, routing, and UI icon/text rendering.

  type         VARCHAR(50)   NOT NULL                  Notification delivery channel only: SYSTEM_ONLY, EMAIL_ONLY, or ALL. Independent of event_type.

  title                 VARCHAR(255)           NOT NULL                           Notification title.

  content               TEXT                   NULL                               Notification message content.

  related_url           VARCHAR(255)           NULL                               Related URL for redirecting the user to the relevant page.

  is_read               TINYINT(1)             DEFAULT 0                          Indicates whether the notification has been read.

  is_sent_email         TINYINT(1)             DEFAULT 0                          Indicates whether the email notification was sent successfully.

  sent_at               DATETIME               NULL                               Time when the email notification was sent.

  created_at            DATETIME               DEFAULT CURRENT_TIMESTAMP, INDEX   Notification creation time.
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.4.18 task_attachments

  -----------------------------------------------------------------------------------------------------------
  Column Name       Data Type         Constraint / Key              Description
  ----------------- ----------------- ----------------------------- -----------------------------------------
  id                INT               PRIMARY KEY, AUTO_INCREMENT   Unique attachment identifier.

  task_id           INT               NOT NULL, FOREIGN KEY         References `tasks(id)`.

  user_id           INT               NOT NULL, FOREIGN KEY         References `users(id)` as the uploader.

  file_name         VARCHAR(255)      NOT NULL                      Original file name.

  file_url          VARCHAR(500)      NOT NULL                      File storage URL.

  file_size         INT               NULL                          File size in bytes.

  uploaded_at       DATETIME          DEFAULT CURRENT_TIMESTAMP     Upload time.
  -----------------------------------------------------------------------------------------------------------

## 6.5 Primary Keys

Primary keys are used to uniquely identify records in each table.

  ------------------------------------------------------------------------------
  Table Name              Primary Key              Type
  ----------------------- ------------------------ -----------------------------
  roles                   id                       Single-column primary key

  permissions             id                       Single-column primary key

  role_permissions        role_id, permission_id   Composite primary key

  users                   id                       Single-column primary key

  password_resets         id                       Single-column primary key

  departments             id                       Single-column primary key

  employee_profiles       user_id                  Primary key and foreign key

  clients                 id                       Single-column primary key

  jobs                    id                       Single-column primary key

  time_locks              id                       Single-column primary key

  audit_logs              id                       Single-column primary key

  tasks                   id                       Single-column primary key

  task_followers          id                       Single-column primary key

  task_comments           id                       Single-column primary key

  log_works               id                       Single-column primary key

  daily_user_timesheets   user_id, work_date       Composite primary key

  notifications           id                       Single-column primary key

  task_attachments        id                       Single-column primary key
  ------------------------------------------------------------------------------

The `role_permissions` table uses a composite primary key to prevent duplicate role-permission mappings. The `daily_user_timesheets` table uses a composite primary key to ensure that each user has only one daily total-hours record for each work date.

## 6.6 Foreign Keys

Foreign keys are used to maintain relationships between tables and prevent orphan records.

  -----------------------------------------------------------------------------------
  Table Name              Foreign Key Column   References        Delete Rule
  ----------------------- -------------------- ----------------- --------------------
  role_permissions        role_id              roles(id)         ON DELETE CASCADE

  role_permissions        permission_id        permissions(id)   ON DELETE CASCADE

  users                   role_id              roles(id)         Not specified

  departments             manager_id           users(id)         ON DELETE SET NULL

  employee_profiles       user_id              users(id)         ON DELETE CASCADE

  employee_profiles       department_id        departments(id)   ON DELETE RESTRICT

  jobs                    client_id            clients(id)       ON DELETE RESTRICT

  jobs                    manager_id           users(id)         ON DELETE RESTRICT

  time_locks              locked_by            users(id)         ON DELETE RESTRICT

  time_locks              job_id               jobs(id)          ON DELETE RESTRICT

  time_locks              unlocked_by          users(id)         ON DELETE SET NULL

  audit_logs              user_id              users(id)         ON DELETE SET NULL

  tasks                   job_id               jobs(id)          ON DELETE RESTRICT

  tasks                   assignee_id          users(id)         ON DELETE RESTRICT

  tasks                   creator_id           users(id)         ON DELETE RESTRICT

  task_followers          task_id              tasks(id)         ON DELETE CASCADE

  task_followers          user_id              users(id)         ON DELETE CASCADE

  task_comments           task_id              tasks(id)         ON DELETE CASCADE

  task_comments           user_id              users(id)         ON DELETE RESTRICT

  log_works               task_id              tasks(id)         ON DELETE RESTRICT

  log_works               user_id              users(id)         ON DELETE RESTRICT

  log_works               reviewed_by          users(id)         ON DELETE SET NULL

  log_works               adjusted_by          users(id)         ON DELETE SET NULL

  daily_user_timesheets   user_id              users(id)         Not specified

  notifications           user_id              users(id)         ON DELETE CASCADE

  task_attachments        task_id              tasks(id)         ON DELETE CASCADE

  task_attachments        user_id              users(id)         ON DELETE RESTRICT
  -----------------------------------------------------------------------------------

Foreign key rules are used to protect business history. Important historical data such as jobs, tasks, log work records, task comments, and audit logs should not be accidentally removed. For fields where the current database document does not explicitly define a delete rule, this document marks the delete rule as `Not specified`.

## 6.7 Constraints and Indexes

This section summarizes the main constraints and indexes used in the WorkTracker database.

### 6.7.1 Unique Constraints

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table Name                       Column / Columns                Purpose
  -------------------------------- ------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  roles                            code                            Prevent duplicate role codes.

  permissions                      code                            Prevent duplicate permission codes.

  role_permissions                 role_id, permission_id          Prevent duplicate permission assignment for the same role.

  users                            email                           Prevent duplicate login accounts.

  password_resets                  token                           Prevent duplicate reset tokens.

  departments                      name                            Prevent duplicate department names.

  clients                          tax_code                        Prevent duplicate client tax codes.

  time_locks                       lock_month, lock_year           Prevent duplicate GLOBAL-scoped lock records for the same month and year, using a partial unique constraint where lock_scope = GLOBAL and job_id IS NULL.

  time_locks                       lock_month, lock_year, job_id   Prevent duplicate JOB-scoped lock records for the same month, year, and job, using a partial unique constraint where lock_scope = JOB and job_id IS NOT NULL.

  task_followers                   task_id, user_id                Prevent the same user from following the same task more than once.

  daily_user_timesheets   user_id, work_date     Prevent duplicate daily timesheet records for the same user and date.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.7.2 Check Constraints

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Table Name               Constraint                                                                                                     Purpose
  ------------------------ -------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------
  daily_user_timesheets    CHECK total_hours \<= 24                                                                                       Prevent a user from logging more than 24 total hours in one day.

  task_comments   CHECK comment_type IN (\'NORMAL\', \'REJECTION_NOTE\')                                                Restrict comment_type to its two valid values.

  time_locks      CHECK (lock_scope = \'GLOBAL\' AND job_id IS NULL) OR (lock_scope = \'JOB\' AND job_id IS NOT NULL)   Ensure job_id is set only and exactly when lock_scope = JOB, preventing an unscoped lock that silently fails to restrict any job.

  log_works       CHECK review_status IN (\'PENDING\', \'APPROVED\', \'REJECTED\', \'VOIDED\')                          Restrict review_status to its four valid values.
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.7.3 Important Indexes

  ----------------------------------------------------------------------------------
  Table Name        Indexed Column   Purpose
  ----------------- ---------------- -----------------------------------------------
  roles             code             Fast lookup by role code.

  permissions       code             Fast permission checking by code.

  users             email            Fast login lookup.

  users             is_active        Fast filtering of active or inactive users.

  password_resets   email            Fast password reset lookup by email.

  password_resets   token            Fast token validation.

  clients           tax_code         Fast client lookup and uniqueness validation.

  clients           is_active        Fast filtering of active or inactive clients.

  jobs              deadline         Fast overdue job lookup.

  tasks             priority         Fast filtering by priority.

  tasks             status           Fast filtering by Kanban status.

  tasks             deadline         Fast overdue task lookup.

  tasks             order_index      Fast Kanban ordering.

  task_comments     created_at       Fast chronological comment loading.

  audit_logs        created_at       Fast audit log filtering by date.

  notifications     user_id          Fast lookup of notifications by receiver.

  notifications     created_at       Fast notification history loading.
  ----------------------------------------------------------------------------------

### 6.7.4 Delete Rules

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Delete Rule             Tables / Relationships                                                                                                                                                                                                                                Purpose
  ----------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------------------------------
  ON DELETE CASCADE       `role_permissions.role_id`, `role_permissions.permission_id`, `employee_profiles.user_id`, `task_followers.task_id`, `task_followers.user_id`, `task_comments.task_id`, `notifications.user_id`, `task_attachments.task_id`                           Automatically remove dependent records when the parent record is removed.

  ON DELETE RESTRICT      employee_profiles.department_id, jobs.client_id, jobs.manager_id, time_locks.locked_by, time_locks.job_id, tasks.job_id, tasks.assignee_id, tasks.creator_id, task_comments.user_id, log_works.task_id, log_works.user_id, task_attachments.user_id   Protect important business and historical records from accidental deletion.

  ON DELETE SET NULL      departments.manager_id, audit_logs.user_id, log_works.reviewed_by, log_works.adjusted_by                                                                                                                                                              Preserve the main record while clearing the unavailable user reference.

  Not specified           `users.role_id`, `daily_user_timesheets.user_id`                                                                                                                                                                                                      The current database document defines these fields as foreign keys but does not explicitly state the delete rule.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 6.7.5 Data Integrity Rules

The database enforces the following important integrity rules:

1.  A user must reference a valid role.
2.  A user email must be unique.
3.  A role code must be unique.
4.  A permission code must be unique.
5.  A department name must be unique.
6.  A client tax code must be unique.
7.  A role-permission pair must not be duplicated.
8.  A job must reference a valid client and a valid manager.
9.  A task must reference a valid job, assignee, and creator.
10. A task follower record must not duplicate the same task-user pair.
11. A log work record must reference a valid task and user.
12. A timesheet lock must be unique by month, year, scope, and job (for JOB-scoped locks).
13. Daily total work hours must not exceed 24 hours per user per day.
14. Work hour values must use `DECIMAL(4,2)` to avoid floating-point calculation errors.
15. Task ordering must use `order_index` with `VARCHAR(255)` to support Kanban drag-and-drop ordering.
16. Audit logs should remain available for administrative review.
17. Notifications should be persisted in the database even if realtime delivery fails.
18. Physical file content should not be stored directly in relational tables; only file metadata and file URL should be stored.
19. Log work records must not be physically deleted; removal is represented by review_status = VOIDED to preserve traceability.

### 6.7.6 Defensive Database Programming for Log Work

The log_works table is controlled by defensive database and backend transaction logic to protect timesheet data.

Before inserting or updating log work records, the system should perform the following checks, all within the same database transaction:

1.  Check whether the related month and year are locked for the log work\'s parent job (a JOB-scoped lock with matching job_id) or system-wide (a GLOBAL-scoped lock), per FR-57.

2.  If the period is locked, reject the operation.

3.  Check that work_date is not later than the current date (no future-dated entries).

4.  Check that the parent task\'s status and the parent job\'s status are not Cancelled; reject the operation if either is Cancelled.

5.  If the parent task or job status is Completed, allow the operation only if explicitly enabled by configuration (default: disabled); otherwise reject and direct the user to contact their Manager to reopen the task.

6.  If all the above checks pass, lock the related daily_user_timesheets row using SELECT \... FOR UPDATE (PostgreSQL row-level lock) within the same transaction.

7.  Recalculate the total work hours for the user and work date.

8.  Reject and roll back the transaction if total hours exceed 24.

9.  Commit the transaction only if the operation is valid.

Voiding an existing log work record (setting review_status = VOIDED, per FR-62) follows only the time-lock check above; the job/task status checks do not apply to voiding, since marking erroneous history as void does not create new hours against a closed job or task. Voiding never physically removes the record.

Performing the time-lock check and the SELECT \... FOR UPDATE row lock within the same transaction as the write prevents a period from being locked, or a record from being deleted, in the gap between validation and commit. This mechanism prevents invalid timesheet modification and protects the system from race conditions when multiple log work requests are submitted at nearly the same time.
