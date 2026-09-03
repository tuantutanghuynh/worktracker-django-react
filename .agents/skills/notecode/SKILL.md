---
name: notecode
description: Use when adding, cleaning up, or standardizing code comments in English using concise file headers and 1-line function descriptions without altering any code logic.
---

# notecode: Standardizing Code Comments (Concise & English Only)

## Overview
This skill provides a simple, clean, and consistent commenting standard across Frontend (React/TS/JS) and Backend (Django/Python) codebases.

**Core Rules:**
1. **100% English**: All comments, overviews, and descriptions must be in English.
2. **Zero Code Changes**: Strictly modify comments/docstrings only. Never modify variables, logic, imports, or code syntax.
3. **Top Header**: Include a concise file overview block at the top of every file.
4. **1-Line Function Comments**: Every function, component, or method receives a simple, clear 1-line summary above it.

---

## 1. Frontend Standard (React / TypeScript / JavaScript)

### A. File Header (Top of file)
```typescript
/**
 * @fileoverview [FileName].[tsx|ts|jsx|js]
 * [Brief description of what this component or file does].
 * [Where or how it is used in the application].
 */
```

*Example:*
```typescript
/**
 * @fileoverview JobCard.tsx
 * Component for displaying job overview, progress indicator, and action buttons.
 * Used within Manager Dashboard and Job Management screens.
 */
```

### B. Function & Component Comments (Simple 1-Line)
Use a single clear line `// ...` directly above each component, hook, handler, or helper function.

*Example:*
```typescript
// Renders the job summary card with status badges and action triggers.
export const JobCard: React.FC<JobCardProps> = ({ job, onSelect }) => {

  // Calculates whether the job has exceeded its deadline.
  const isOverdue = useMemo(() => { ... }, [job.dueDate]);

  // Handles card selection and passes the job ID to parent callback.
  const handleCardClick = () => { ... };

  // Opens the quick edit modal for admin users.
  const handleOpenEditModal = () => { ... };

  return ( ... );
};
```

---

## 2. Backend Standard (Django / Python)

### A. File Header (Top of file)
```python
"""
Module: [module_path_or_filename]
Description: [Brief description of what this file does and its role in the system].
"""
```

*Example:*
```python
"""
Module: apps.jobs.services.job_service
Description: Handles core business logic for job assignment, progress tracking, and validation.
"""
```

### B. Class & Function Comments (Simple 1-Line Docstring)
Use a concise 1-line docstring `"""Summary."""` or comment `# ...` inside/above classes and methods.

*Example:*
```python
class JobService:
    """Service handling business operations and progress calculations for jobs."""

    @staticmethod
    def calculate_job_progress(job_id: int) -> float:
        """Calculate overall job completion percentage based on completed subtasks."""
        ...

    @classmethod
    def assign_user_to_job(cls, job_id: int, user_id: int, assigned_by: User) -> JobAssignment:
        """Assign an active user to a job and trigger a push notification."""
        ...
```

---

## 3. Quick Action Tags (Optional)

Use standard tags only when marking future work or known notes:
- `// TODO: [1-line explanation of upcoming work]`
- `// NOTE: [1-line explanation of technical reason]`
- `// FIXME: [1-line explanation of known issue]`

---

## 4. Verification Rule

Before completing the task:
- Run `git diff` to confirm that **no logic, syntax, variable, or statement** was modified.
- Verify that every comment is in proper English and strictly concise.
