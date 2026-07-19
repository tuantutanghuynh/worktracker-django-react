# WORKTRACKER SYSTEM DESIGN DOCUMENT

## Document Control

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Item                                Description
  ----------------------------------- ----------------------------------------------------------------------------------------------------------------------------------
  Document Title                      WorkTracker System Design Document

  Project Name                        WorkTracker - Work Management and Time Tracking System

  Document Type                       System Design and Requirements Documentation

  Document Version                    Version 1.0

  Document Status                     Draft

  Prepared By                         Long Nguyen

  Reviewed By                         Instructor / Supervisor

  Approved By                         Instructor / Supervisor

  Created Date                        28/06/2026

  Last Updated Date                   28/06/2026

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

The WorkTracker system is developed to address these limitations by providing a centralized web-based platform for work management and time tracking. The system supports organizations in managing clients, jobs, tasks, employees, timesheets, reports, notifications, and audit logs in a structured and traceable manner.

WorkTracker aims to digitize the internal work management process, improve collaboration between managers and employees, reduce manual tracking effort, and provide reliable data for performance monitoring and decision-making.

## 1.2 Problem Statement

The current manual or semi-manual approach to work management creates several problems for organizations.

First, task information is often scattered across different tools such as Excel files, emails, and chat messages. This makes it difficult for managers to have a clear overview of project progress and employee workload.

Second, tracking task status manually can lead to delays, missing updates, duplicated information, or unclear responsibility. Managers may not know which tasks are pending, in progress, waiting for review, completed, or overdue.

Third, timesheet data can be difficult to control when employees record working hours manually. Without a centralized validation mechanism, users may enter invalid working hours, duplicate records, or modify timesheet data after the reporting period has been closed.

Fourth, reporting and performance evaluation become inefficient because data must be collected from multiple sources. This increases the risk of inaccurate reports and slows down management decision-making.

Fifth, without an audit logging mechanism, it is difficult to trace sensitive actions such as changing deadlines, locking timesheets, updating user accounts, modifying task status, or exporting reports. This reduces transparency and makes responsibility tracking difficult when disputes or errors occur.

Therefore, a centralized work management system is required to organize project data, control task workflows, manage timesheets, support reporting, deliver notifications, and preserve audit history.

## 1.3 Project Objectives

The main objective of the WorkTracker project is to develop a web-based system that supports centralized work management and time tracking for internal business operations.

The specific objectives of the project are as follows:

1.  To provide a secure authentication and authorization mechanism based on user roles.

2.  To support three main user roles: Admin, Manager, and Employee.

3.  To allow Admin users to manage system accounts, roles, permissions, clients, jobs, and audit logs.

4.  To allow Manager users to create jobs, assign tasks, monitor task progress, review task completion, manage team timesheets, lock timesheet periods, and generate reports.

5.  To allow Employee users to view assigned tasks, update task progress, submit work for review, log working hours, participate in task discussions, receive notifications, and manage personal profile information.

6.  To support client and job management so that every project can be linked to a specific client and managed by a responsible manager.

7.  To provide task management with Kanban-style workflow tracking, including task assignment, priority management, deadline management, status updates, review, approval, and rejection.

8.  To provide timesheet management that allows employees to record work hours for assigned tasks.

9.  To enforce timesheet validation rules, including prevention of more than 24 logged hours per day and prevention of modification when a timesheet period is locked.

10. To provide realtime and email-based notifications for important events such as task assignment, comments, review decisions, timesheet locking, and system updates.

11. To provide reporting and analytics features for monitoring task progress, work hours, employee performance, and project status.

12. To maintain audit logs for sensitive actions so that the system can support traceability, accountability, and administrative review.

13. To design a maintainable and scalable system architecture using modern web technologies.

## 1.4 Project Scope

The WorkTracker project focuses on the development of a web-based system for internal work management and time tracking. The system is designed to help organizations manage work-related data and workflows through a centralized platform.

The project covers the main areas of user access control, client management, job management, task tracking, timesheet recording, notification, reporting, profile management, and audit logging. These areas are included because they are directly related to the purpose of the system: supporting project coordination, employee task execution, work hour tracking, performance monitoring, and administrative supervision.

The scope of the WorkTracker project includes the following areas:

### 1.4.1 User and Access Management

This area covers user account management, authentication, password recovery, role-based access control, and account status management. The system is designed around three main user roles: Admin, Manager, and Employee. Each role has a different responsibility and access scope within the system.

### 1.4.2 Client and Job Management

This area covers the management of client information and master job information. Clients represent the organizations, partners, or business entities related to project work. Jobs represent larger work packages or projects that are associated with clients and managed by responsible managers.

### 1.4.3 Task and Kanban Management

This area covers task planning, task assignment, task tracking, task priority, deadline control, review workflow, comments, followers, attachments, and Kanban-based visualization. It supports the process of breaking down jobs into smaller tasks and monitoring their progress through different workflow stages.

### 1.4.4 Timesheet and Time Lock Management

This area covers work hour recording, timesheet validation, daily work hour control, and timesheet period locking. It ensures that employees can record work hours for assigned work while allowing authorized users to protect timesheet data after a reporting period is closed.

### 1.4.5 Notification and Collaboration

This area covers task-related communication, task comments, realtime notifications, email notifications, and notification history. It supports coordination between Admin, Manager, and Employee users during task assignment, task review, discussion, and system events.

### 1.4.6 Profile Management

This area covers personal profile viewing and updating. Profile data may include basic employee information such as full name, phone number, department information, and avatar.

### 1.4.7 Reporting and Analytics

This area covers dashboards, task progress summaries, timesheet reports, employee performance indicators, job status summaries, and exportable reports. Reporting features are intended to support management review, operational monitoring, and decision-making.

### 1.4.8 Audit Logging

This area covers the recording of important system actions for monitoring, inspection, traceability, and responsibility tracking. Audit logging helps administrators review sensitive actions and investigate system changes when necessary.

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

-   Task dependency relationships and subtasks or checklist items within a task (tasks remain a flat structure).

These features may be considered as future improvements.

## 1.5 Target Users

The WorkTracker system is designed for three main user groups: Admin, Manager, and Employee.

### 1.5.1 Admin

Admin is the highest-level user in the system. Admin is responsible for managing system-level data, user access, client information, master jobs, reports, and audit logs.

The main responsibilities of Admin include:

-   Managing user accounts.
-   Managing roles and permissions.
-   Managing client information.
-   Managing master job information.
-   Monitoring global dashboard metrics.
-   Viewing system audit logs.
-   Locking or deactivating user accounts when necessary.
-   Exporting system-level reports.

Admin users require broad access to system data and configuration because they are responsible for system control and administrative supervision.

### 1.5.2 Manager

Manager is responsible for coordinating work within jobs where the Manager is the responsible manager (jobs.manager_id).

The main responsibilities of Manager include:

-   Creating and managing tasks.
-   Assigning tasks to employees.
-   Setting task priority and deadlines.
-   Monitoring task progress.
-   Reviewing submitted work.
-   Approving or rejecting task completion.
-   Managing timesheet data for employees working on the Manager\'s jobs.
-   Locking timesheet periods when required.
-   Exporting reports within the authorized management scope.
-   Monitoring performance of employees working on the Manager\'s jobs.

Manager users should only access data within jobs where jobs.manager_id equals their own user ID. They should not be able to view or modify unrelated jobs, tasks, or reports.

### 1.5.3 Employee

Employee is the user who directly performs assigned work.

The main responsibilities of Employee include:

-   Viewing assigned tasks.
-   Updating task status.
-   Submitting completed work for review.
-   Writing task comments.
-   Uploading task attachments when required.
-   Logging work hours for assigned tasks.
-   Viewing personal dashboard and performance indicators.
-   Receiving notifications.
-   Updating personal profile information.

Employee users should only access their own tasks, timesheets, notifications, and profile data unless they are explicitly granted additional permissions.

## 1.6 Technology Stack

The WorkTracker system is designed using a modern Client-Server web architecture. The frontend handles user interaction and presentation, while the backend handles authentication, authorization, business logic, validation, database operations, notification processing, reporting, and audit logging.

### 1.6.1 Frontend Technologies

  -----------------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- -----------------------------------------------------------------------------------------
  React Vite                          Used to build the frontend web application with fast development and build performance.

  TypeScript                          Used to improve code safety, type checking, and maintainability.

  React Router DOM                    Used to manage frontend routing and protected routes.

  Zustand                             Used for lightweight global state management.

  React Hook Form                     Used to manage form state and form submission.

  Zod                                 Used for frontend schema validation and input validation.

  TanStack Table                      Used to build data tables with pagination, filtering, and sorting.

  Shadcn UI                           Used to build consistent and reusable UI components.

  Recharts / Chart.js                 Used to display dashboard charts and reporting visualizations.

  DnD Kit                             Used to implement drag-and-drop interaction for the Kanban board.
  -----------------------------------------------------------------------------------------------------------------------------

### 1.6.2 Backend Technologies

  -------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- -------------------------------------------------------------------------------
  Django                              Used as the main backend web framework.

  Django REST Framework               Used to build RESTful API endpoints.

  Django Simple JWT                   Used to implement JWT-based authentication.

  Django Channels                     Used to support WebSocket and realtime communication.

  Celery                              Used to process background tasks such as email sending and asynchronous jobs.
  -------------------------------------------------------------------------------------------------------------------

### 1.6.3 Database and Infrastructure

  --------------------------------------------------------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- --------------------------------------------------------------------------------
  PostgreSQL                          Used as the primary relational database for storing system data.

  Redis                               Used for caching, realtime communication support, and background task support.

  WebSocket                           Used for realtime notification delivery.

  SMTP Email Service                  Used to send password reset emails and notification emails.
  --------------------------------------------------------------------------------------------------------------------

### 1.6.4 Supporting Tools

  -----------------------------------------------------------------------
  Tool                  Purpose
  --------------------- -------------------------------------------------
  Git                   Used for source code version control.

  GitHub                Used for repository hosting and collaboration.

  Postman               Used for API testing and documentation support.

  Docker                Optional tool for containerized deployment.

  Visual Studio Code    Used as the development environment.
  -----------------------------------------------------------------------

### 1.6.5 Technology Stack Summary

The selected technology stack supports the main goals of the WorkTracker system: secure authentication, role-based access control, structured task management, accurate timesheet processing, realtime notification, reporting, and maintainable web application development.

React Vite and TypeScript provide a modern frontend foundation. Django and Django REST Framework provide a stable backend API layer. PostgreSQL provides relational data integrity. Redis, WebSocket, Django Channels, and Celery support realtime and asynchronous processing. SMTP supports email-based communication such as password reset and system notifications.

Together, these technologies allow WorkTracker to operate as a centralized, secure, and extensible work management and time tracking platform.
