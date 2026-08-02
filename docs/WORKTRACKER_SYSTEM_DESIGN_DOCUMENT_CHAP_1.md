# WORKTRACKER SYSTEM DESIGN DOCUMENT

## Document Control

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ----------------------------------------------------------------------------------------------------------------------------------
  Document Title                      WorkTracker System Design Document

  Project Name                        WorkTracker - Work Management and Time Tracking System

  Document Type                       System Design and Requirements Documentation

  Document Version                    Version 1.1

  Document Status                     Approved / Active

  Prepared By                         Long Nguyen

  Reviewed By                         Instructor / Supervisor

  Approved By                         Instructor / Supervisor

  Created Date                        28/06/2026

  Last Updated Date                   02/08/2026

  Intended Audience                   Instructor, Developer, Tester, Project Evaluator

  Confidentiality Level               Academic / Internal Use

  Related Documents                   Project Overview, DFD Documentation, ERD Documentation, Database Structure, Functional Requirements, Non-Functional Requirements
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

### Document Purpose

This document describes the complete system design documentation for the WorkTracker project. It provides a structured specification of the project overview, software requirements, use cases, data flow diagrams, entity relationship diagrams, database dictionary, software architecture, API design, user interface design, security design, testing plan, deployment guide, and user manual.

The purpose of this document is to provide a clear and complete reference for system analysis, system design, implementation, testing, evaluation, and future maintenance of the WorkTracker system.

### Document Scope

This document covers the design and specification of the WorkTracker web-based system, including:

-   User authentication and authorization.
-   Role-based access control for Admin, Manager, and Employee.
-   Client and job management.
-   Task and Kanban management.
-   Timesheet and log work management.
-   Time lock control.
-   Notification and collaboration.
-   Profile management.
-   Reporting and export.
-   Audit logging.
-   Database design.
-   API design.
-   UI/UX design.
-   Security design.
-   Testing and deployment.

This document does not cover advanced accounting, payroll processing, financial management, or full human resource management modules. These areas are outside the current scope of the WorkTracker project.

# CHAPTER 1: PROJECT OVERVIEW

## 1.1 Project Background

In modern organizations, multiple projects are often executed at the same time by different departments, teams, managers, and employees. As the number of projects and employees increases, managing tasks, monitoring work progress, tracking working time, and evaluating employee performance become increasingly complex.

Many organizations still rely on separate tools such as spreadsheets, email, and messaging applications to manage daily work. Although these tools are simple to use, they are not designed to provide a centralized workflow for assigning tasks, tracking progress, recording working hours, generating reports, or tracing important activities. As a result, managers may face difficulties in monitoring project status, identifying delayed tasks, evaluating employee workload, and controlling timesheet data accurately.

The WorkTracker system is developed to address these limitations by providing a centralized web-based platform for work management and time tracking. The system supports organizations in managing clients, master jobs, tasks, employees, timesheets, reports, notifications, and audit logs in a structured and traceable manner.

WorkTracker aims to digitize the internal work management process, improve collaboration between managers and employees, reduce manual tracking effort, and provide reliable data for performance monitoring and decision-making.

## 1.2 Problem Statement

The current manual or semi-manual approach to work management creates several problems for organizations.

First, task information is often scattered across different tools such as Excel files, emails, and chat messages. This makes it difficult for managers to have a clear overview of project progress and employee workload.

Second, tracking task status manually can lead to delays, missing updates, duplicated information, or unclear responsibility. Managers may not know which tasks are pending, in progress, waiting for review, completed, or overdue.

Third, timesheet data can be difficult to control when employees record working hours manually. Without a centralized validation mechanism, users may enter invalid working hours, duplicate records, or modify timesheet data after the reporting period has been closed.

Fourth, reporting and performance evaluation become inefficient because data must be collected from multiple sources. Generating reports manually increases the risk of inaccurate data and slows down management decision-making.

Fifth, without an audit logging mechanism, it is difficult to trace sensitive actions such as changing deadlines, locking timesheets, updating user accounts, modifying task status, or exporting reports. This reduces transparency and makes responsibility tracking difficult when disputes or errors occur.

Therefore, a centralized work management system is required to organize project data, control task workflows, manage timesheets, support reporting, deliver notifications, and preserve audit history.

## 1.3 Project Objectives

The main objective of the WorkTracker project is to develop a web-based system that supports centralized work management and time tracking for internal business operations.

The specific objectives of the project are as follows:

1.  To provide a secure authentication and authorization mechanism based on user roles, supporting token revocation on logout and instant account locking.

2.  To support three main user roles organized into role-separated modules: Admin, Manager, and Employee.

3.  To allow Admin users to manage system accounts, roles, permissions, client business profiles, master jobs, and audit logs.

4.  To allow Manager users to create jobs with unique job codes, assign tasks, monitor task progress on a Kanban board, review task completion, manage team timesheets, lock timesheet periods, and generate exportable reports.

5.  To allow Employee users to view assigned tasks, update task progress, submit work for review, log working hours, participate in task discussions, receive notifications, and manage personal profile information.

6.  To support client and job management so that every project can be linked to a specific client with full contact details and managed by a responsible manager using a unique project code.

7.  To provide task management with Kanban-style workflow tracking (`TODO`, `IN_PROGRESS`, `REVIEWING`, `COMPLETED`, `CANCELLED`), including task assignment, priority management, deadline control, status updates, review, approval, and rejection.

8.  To provide timesheet management that allows employees to record work hours for assigned tasks and allows managers to review, approve, reject, correct, or void logwork entries.

9.  To enforce timesheet validation rules, including prevention of more than 24 logged hours per day (with an 8-hour daily soft limit bar) and prevention of modification when a timesheet period is locked.

10. To provide realtime and email-based notifications for important events such as task assignment, comments, review decisions, timesheet locking, and system updates.

11. To provide reporting and analytics features for monitoring task progress, work hours, employee performance, and project status with PDF and Excel export capabilities.

12. To maintain audit logs for sensitive actions so that the system can support traceability, accountability, and administrative review.

13. To design a maintainable and scalable system architecture using modern web technologies verified by automated testing.

## 1.4 Project Scope

The WorkTracker project focuses on the development of a web-based system for internal work management and time tracking. The system is designed to help organizations manage work-related data and workflows through a centralized platform.

The project covers the main areas of user access control, client management, job management, task tracking, timesheet recording, notification, reporting, profile management, and audit logging.

The scope of the WorkTracker project includes the following areas:

### 1.4.1 User and Access Management

This area covers user account management, authentication, forced password reset (`must_change_password`), role-based access control (RBAC), and account status management (`is_active` status with instant cache eviction). The system is organized around three main user roles: Admin, Manager, and Employee, structured in dedicated role packages (`admin`, `manager`, `employee`).

### 1.4.2 Client and Job Management

This area covers the management of client business profiles (tax code, contact person, email, phone, address, industry, notes) and master job information. Each job is assigned a unique human-readable job code (`job_code`, e.g., `JOB-2026-001`), budget/hours, priority, deadline, status, and is linked to a client and a responsible manager.

### 1.4.3 Task and Kanban Management

This area covers task planning, task assignment, task tracking, task priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), deadline control, review workflow, comments, followers, attachments, and Kanban-based visualization across 5 workflow stages (`TODO`, `IN_PROGRESS`, `REVIEWING`, `COMPLETED`, `CANCELLED`).

### 1.4.4 Timesheet and Time Lock Management

This area covers work hour recording, timesheet validation, daily work hour control, logwork review actions (`Approve`, `Reject`, `Correct`, `Void`), and timesheet period locking (`TimeLock` lock/unlock controls with reason logging).

### 1.4.5 Notification and Collaboration

This area covers task-related communication, task comments, realtime WebSocket notifications, email notifications, and notification history with mark-as-read functionality.

### 1.4.6 Profile Management

This area covers personal profile viewing and updating, avatar upload, contact details, department assignment, and security settings.

### 1.4.7 Reporting and Analytics

This area covers executive dashboards (KPI cards, productivity heatmaps, status breakdown charts, timesheet trend lines), task progress summaries, timesheet detail reports, employee performance indicators, and exportable reports in PDF and Excel formats containing job codes and client details.

### 1.4.8 Audit Logging

This area covers the recording of important system actions for monitoring, inspection, traceability, and responsibility tracking, including historical change tracking and visual diff viewing for administrative review.

### 1.4.9 Out of Scope

The following areas are outside the current scope of the WorkTracker project:
-   Payroll processing.
-   Accounting management.
-   Financial management.
-   Advanced human resource management.
-   Customer relationship management beyond basic client information.
-   Mobile application development.
-   Advanced AI-based performance prediction.
-   External third-party project management integrations.
-   Task dependency relationships and subtasks (tasks remain a flat structure).

## 1.5 Target Users

The WorkTracker system is designed for three main user groups: Admin, Manager, and Employee.

### 1.5.1 Admin

Admin is the highest-level user in the system. Admin is responsible for managing system-level data, user access, client information, master jobs, reports, and audit logs.

The main responsibilities of Admin include:
-   Managing user accounts and forcing password resets.
-   Managing roles and permissions.
-   Managing client business information and master jobs.
-   Monitoring global dashboard metrics.
-   Viewing system audit logs and historical changes.
-   Locking or deactivating user accounts when necessary.
-   Exporting system-level reports.

### 1.5.2 Manager

Manager is responsible for coordinating work within jobs where the manager is the designated project manager (`jobs.manager_id`).

The main responsibilities of Manager include:
-   Creating and managing tasks assigned to their jobs.
-   Assigning tasks to employees and setting priority and deadlines.
-   Monitoring task progress on the Kanban board.
-   Reviewing submitted work (approving or rejecting with required reasons).
-   Managing timesheet data for employees working on the manager's jobs.
-   Locking timesheet periods (`TimeLock`) for specific months/years with reason tracking.
-   Exporting PDF and Excel reports with job codes and client details.
-   Monitoring team performance and productivity metrics.

### 1.5.3 Employee

Employee is the user who directly performs assigned work.

The main responsibilities of Employee include:
-   Viewing assigned tasks.
-   Updating task status (`IN_PROGRESS`, `REVIEWING`).
-   Submitting completed work for review with notes.
-   Writing task comments.
-   Logging work hours for assigned tasks up to the daily 8h soft limit / 24h hard limit.
-   Viewing personal dashboard and performance indicators.
-   Receiving realtime notifications for task assignments and review decisions.
-   Updating personal profile information and uploading avatars.

## 1.6 Technology Stack

The WorkTracker system is designed using a modern Client-Server web architecture. The frontend handles user interaction and presentation, while the backend handles authentication, authorization, business logic, validation, database operations, notification processing, reporting, and audit logging.

### 1.6.1 Frontend Technologies

  ----------------------------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- ----------------------------------------------------------------------------------------------------
  React Vite                          Used to build the frontend web application with fast dev server and build performance.

  JavaScript (ES6+ / JSX)             Used for core application logic and component structure.

  Tailwind CSS v4                     Used for utility-first styling with custom Dark Slate palette (`#0F172A`) and micro-animations.

  React Router DOM                    Used to manage frontend routing and protected routes.

  Zustand                             Used for lightweight global state management (Auth state, User info, Unread notifications).

  TanStack Query (React Query)        Used for server state management, API caching, and background refetching.

  React Hook Form & Zod               Used for form state management and input schema validation.

  TanStack Table                      Used to build data tables with pagination, multi-column sorting, and filtering.

  Recharts                            Used to display dashboard charts and reporting visualizations.

  DnD Kit                             Used to implement drag-and-drop interaction for the 5-column Kanban board.

  Radix UI Primitives                 Used as accessible headless UI building blocks (Dialog, Dropdown Menu, Select, Tabs, Tooltip).

  Sonner                              Used for spring-animated toast notifications.

  React Use WebSocket                 Used for realtime WebSocket connection management.
  ----------------------------------------------------------------------------------------------------------------------------------------

### 1.6.2 Backend Technologies

  ----------------------------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- ----------------------------------------------------------------------------------------------------
  Django                              Used as the main backend web framework.

  Django REST Framework (DRF)         Used to build RESTful API endpoints organized in role-separated packages (`admin`, `manager`).

  Django Simple JWT                   Used to implement JWT-based authentication with token revocation and active status check.

  Django Channels & Daphne            Used for ASGI WebSockets (`ws/notifications/`) to deliver realtime notifications.

  Celery & django-celery-results      Used to process asynchronous background tasks such as email sending.

  drf-spectacular                     Used to generate OpenAPI 3.0 schemas and Swagger UI / Redoc documentation (`/api/docs/`).

  django-simple-history               Used for automatic model history tracking and audit logging.

  openpyxl & xhtml2pdf                Used to generate Excel (.xlsx) and PDF (.pdf) reports with custom styling and job code data.
  ----------------------------------------------------------------------------------------------------------------------------------------

### 1.6.3 Database and Infrastructure

  ----------------------------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- ----------------------------------------------------------------------------------------------------
  PostgreSQL                          Used as the primary relational database for storing system data.

  Redis                               Used for caching, Celery broker, and Channels WebSocket layer.

  WebSocket                           Used for realtime notification delivery.

  SMTP Email Service                  Used to send password reset emails and notification emails.
  ----------------------------------------------------------------------------------------------------------------------------------------

### 1.6.4 Supporting Tools & Automated Testing

  ----------------------------------------------------------------------------------------------------------------------------------------
  Tool / Framework                    Purpose
  ----------------------------------- ----------------------------------------------------------------------------------------------------
  pytest & pytest-django              Used for automated unit and integration testing (109 testcases).

  Git & GitHub                        Used for source code version control and multi-branch collaboration.

  Postman / Swagger UI                Used for API testing and interactive documentation.

  Visual Studio Code                  Used as the primary development environment.
  ----------------------------------------------------------------------------------------------------------------------------------------

### 1.6.5 Technology Stack Summary

The selected technology stack supports the main goals of the WorkTracker system: secure authentication, role-based access control, structured task management with job codes, accurate timesheet processing with time locks, realtime notification, rich reporting with PDF/Excel exports, and maintainable web application development verified by automated testing.
