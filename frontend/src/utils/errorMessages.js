/**
 * WorkTracker Pro - Centralized Error Message Dictionary & Helper (English UI)
 * Contains 100% of all API Exception Error Codes from Django REST Framework Backend.
 */

export const ERROR_DICTIONARY = {
  // =================================================================
  // 1. AUTHENTICATION & SECURITY (accounts / system.security)
  // =================================================================
  USER_NOT_AUTHENTICATED: 'Authentication credentials were not provided.',
  USER_INACTIVE: 'Your account is deactivated or inactive. Please contact system administrator.',
  ACCOUNT_INACTIVE: 'Your account is deactivated or inactive.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  MUST_CHANGE_PASSWORD: 'You must change your password before performing this action.',
  TOKEN_REVOKED: 'Your session token has been revoked or blacklisted. Please log in again.',
  TOKEN_INVALID_EXPIRED: 'Your authentication token is invalid or expired.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  USER_IS_NOT_MANAGER: 'Only Manager role is allowed to perform this action.',
  MANAGER_ROLE_REQUIRED: 'Only Manager role is allowed to perform this action.',
  AUTHENTICATION_REQUIRED: 'Authentication is required to perform this action.',

  // =================================================================
  // 2. PROJECT MANAGEMENT (projects)
  // =================================================================
  JOB_OUT_OF_MANAGER_SCOPE: 'This project is outside of your assigned management scope.',
  JOB_STATUS_DOES_NOT_ALLOW_TASK_CREATE: 'Tasks cannot be created for a project with the current status.',
  INVALID_JOB_STATUS_TRANSITION: 'Invalid status transition for this project.',
  JOB_HAS_OPEN_TASKS: 'Project cannot be closed because it still contains active open tasks.',
  JOB_HAS_PENDING_LOGWORK: 'Project cannot be finalized because it has unreviewed work logs.',
  REASON_REQUIRED: 'A reason is required to perform this status change.',
  CANNOT_ASSIGN_INACTIVE_CLIENT: 'Cannot assign project to an inactive client.',
  DEADLINE_BEFORE_START_DATE: 'Project deadline must be on or after start date.',

  // =================================================================
  // 3. TASK & KANBAN MANAGEMENT (tasks)
  // =================================================================
  TASK_OUT_OF_MANAGER_SCOPE: 'This task is outside of your assigned management scope.',
  USER_NOT_ALLOWED_FOR_THIS_TASK_TRANSITION: 'Manager role is not allowed to transition task directly along this workflow.',
  INVALID_TASK_STATUS_TRANSITION: 'Direct status transition is invalid according to business workflow rules.',
  REJECTION_REASON_REQUIRED: 'A reason is required when rejecting a task.',
  CANCELLATION_REASON_REQUIRED: 'A reason is required when cancelling a task.',
  TASK_DEADLINE_EXCEEDS_JOB: 'Task deadline must not exceed project deadline.',
  INVALID_ASSIGNEE: 'Assignee must be an active Employee within your department.',

  // =================================================================
  // 4. TIMESHEETS & TIMELOCK MANAGEMENT (timesheets)
  // =================================================================
  LOGWORK_OUT_OF_MANAGER_SCOPE: 'This work log entry is outside of your management scope.',
  VOIDED_LOGWORK_CANNOT_BE_APPROVED: 'A voided work log entry cannot be approved.',
  LOGWORK_ALREADY_APPROVED: 'This work log entry has already been approved.',
  VOIDED_LOGWORK_CANNOT_BE_REJECTED: 'A voided work log entry cannot be rejected.',
  LOGWORK_ALREADY_REJECTED: 'This work log entry has already been rejected.',
  VOIDED_LOGWORK_CANNOT_BE_CORRECTED: 'A voided work log entry cannot be corrected.',
  LOGWORK_ALREADY_VOIDED: 'This work log entry has already been voided.',
  GLOBAL_PERIOD_IS_LOCKED: 'Timesheet period for this date is globally locked by Admin.',
  JOB_PERIOD_IS_LOCKED: 'Timesheet period for this project is currently locked.',
  MAX_DAILY_HOURS_EXCEEDED: 'Logged hours exceed the maximum allowed daily total limit.',

  // =================================================================
  // 5. FILE UPLOADS & ATTACHMENTS (system / tasks)
  // =================================================================
  FILE_TOO_LARGE: 'Uploaded file size exceeds the maximum allowed limit.',
  INVALID_FILE_TYPE: 'Invalid or unsupported file type uploaded.',

  // =================================================================
  // 6. DEFAULT DRF & SYSTEM ERRORS
  // =================================================================
  NOT_FOUND: 'The requested resource was not found.',
  METHOD_NOT_ALLOWED: 'HTTP method not allowed for this endpoint.',
  DEFAULT_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Extracts human-readable error string from Axios error objects
 * @param {Error|Object} err - Axios error object
 * @param {string} [fallback] - Optional default message
 * @returns {string} Human-readable error message in English
 */
export const getErrorMessage = (err, fallback = ERROR_DICTIONARY.DEFAULT_ERROR) => {
  if (!err) return fallback;

  const data = err?.response?.data;
  const detail = data?.detail;

  // 1. Direct match in dictionary
  if (typeof detail === 'string' && ERROR_DICTIONARY[detail]) {
    return ERROR_DICTIONARY[detail];
  }

  // 2. Field-level DRF errors (e.g. { title: ["This field is required."] })
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const firstKey = Object.keys(data)[0];
    const firstVal = data[firstKey];
    if (Array.isArray(firstVal) && firstVal.length > 0) {
      return `${firstKey}: ${firstVal[0]}`;
    }
    if (typeof firstVal === 'string') {
      return `${firstKey}: ${firstVal}`;
    }
  }

  // 3. String detail without underscores (human-readable string from DRF)
  if (typeof detail === 'string' && detail.trim().length > 0 && !detail.includes('_')) {
    return detail;
  }

  // 4. Network or Timeout Error
  if (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')) {
    return 'Unable to connect to server. Please check your network connection.';
  }

  return fallback;
};

export default getErrorMessage;