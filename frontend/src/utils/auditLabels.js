/**
 * Dịch mọi mã kỹ thuật trong Audit Log sang ngôn ngữ nghiệp vụ thân thiện cho người dùng.
 *
 * Mọi mã bảng DB, tên cột, mã action, chỉ số sắp xếp LexoRank đều được chuẩn hoá
 * sang ngôn ngữ người dùng đọc hiểu ngay lập tức.
 */

// table_name (tên bảng DB) -> Tên phân hệ / nghiệp vụ
export const MODULE_LABELS = {
  users: 'User Account',
  employee_profiles: 'Employee Profile',
  departments: 'Department',
  roles: 'System Role',
  role_permissions: 'Role Permissions',
  clients: 'Client',
  jobs: 'Project',
  tasks: 'Task',
  log_works: 'Work Log',
  timesheets: 'Timesheet',
  daily_user_timesheets: 'Daily Timesheet',
  time_locks: 'Timesheet Period Lock',
  reports: 'Business Report',
  audit_logs: 'Audit Log',
  notifications: 'Notification',
};

// Mã action kỹ thuật -> Tên hành động nghiệp vụ
export const ACTION_LABELS = {
  CREATE: 'Created Record',
  UPDATE: 'Updated Information',
  DELETE: 'Deleted Record',
  LOCK_ACCOUNT: 'Locked User Account',
  UNLOCK_ACCOUNT: 'Unlocked User Account',
  ROLE_CHANGED: 'Changed Account Role',
  RESET_PASSWORD: 'Reset Account Password',
  CHANGE_PASSWORD: 'Changed Password',
  ASSIGN_ROLE: 'Updated Role Permissions',
  EXPORT: 'Exported Report',
  REPORT_EXPORTED: 'Exported Business Report',
  LOCK_TIMESHEET: 'Locked Timesheet Period',
  UNLOCK_TIMESHEET: 'Unlocked Timesheet Period',
  CREATE_JOB: 'Created New Project',
  UPDATE_JOB: 'Updated Project Information',
  UPDATE_JOB_STATUS: 'Changed Project Status',
  CREATE_TASK: 'Created New Task',
  UPDATE_TASK: 'Updated Task Details',
  UPDATE_TASK_STATUS: 'Changed Task Workflow Status',
  REORDER_TASK: 'Reordered Task on Kanban',
  UPLOAD_TASK_ATTACHMENT: 'Uploaded Task Attachment',
  APPROVE_TASK: 'Accepted & Approved Deliverables',
  REJECT_TASK: 'Requested Rework / Rejected Deliverables',
  CANCEL_TASK: 'Cancelled Task',
  RESTORE_TASK: 'Restored Task',
  AUTO_RELEASE_EMPLOYEE: 'Released Employee from Project',
  CREATE_LOG_WORK: 'Logged Work Hours',
  EDIT_LOG_WORK: 'Adjusted Work Log',
  VOID_LOG_WORK: 'Voided Work Log',
  APPROVE_LOG_WORK: 'Approved Work Log',
  REJECT_LOG_WORK: 'Rejected Work Log',
  CORRECT_LOG_WORK: 'Corrected Work Log',
};

// Tên cột trong DB -> Tên trường hiển thị
export const FIELD_LABELS = {
  email: 'Email',
  full_name: 'Full Name',
  phone_number: 'Phone Number',
  is_active: 'Active Status',
  must_change_password: 'Force Password Change',
  role: 'Role',
  role_id: 'Role',
  department: 'Department',
  department_id: 'Department',
  manager: 'Manager',
  manager_id: 'Manager',
  avatar_url: 'Avatar',
  joined_date: 'Joined Date',
  client: 'Client',
  client_id: 'Client',
  client_name: 'Client Name',
  tax_code: 'Tax Code',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  address: 'Address',
  industry: 'Industry',
  notes: 'Notes',
  job: 'Project',
  job_id: 'Project',
  job_name: 'Project Name',
  job_code: 'Project Code',
  task: 'Task',
  task_id: 'Task',
  task_code: 'Task Code',
  title: 'Task Title',
  assignee: 'Assigned Employee',
  assignee_id: 'Assigned Employee',
  status: 'Status',
  priority: 'Priority',
  start_date: 'Start Date',
  deadline: 'Deadline',
  hours_spent: 'Hours Spent',
  total_hours: 'Total Hours',
  work_date: 'Work Date',
  description: 'Description',
  review_status: 'Review Status',
  rejection_reason: 'Rejection Reason',
  adjustment_reason: 'Adjustment Reason',
  is_locked: 'Lock State',
  lock_scope: 'Lock Scope',
  lock_month: 'Lock Month',
  lock_year: 'Lock Year',
  unlocked_reason: 'Unlock Reason',
  order_index: 'Kanban Position (LexoRank)',
  created_at: 'Created At',
  updated_at: 'Updated At',
};

// Các trường nhạy cảm hoặc kỹ thuật nội bộ không cần hiển thị cho người dùng
const HIDDEN_FIELDS = new Set([
  'password',
  'token',
  'refresh_token',
  'hashed_password',
  'last_login',
  'is_superuser',
  'is_staff',
  'groups',
  'user_permissions',
]);

// Giá trị Enum -> Nhãn tiếng Việt / tiếng Anh nghiệp vụ
export const VALUE_LABELS = {
  // Task Status
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEWING: 'Reviewing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',

  // Job Status
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  PAUSED: 'On Hold',

  // Timesheet / LogWork Review Status
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  VOIDED: 'Voided',

  // Priority
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',

  // Role Codes
  ADMIN: 'System Administrator',
  MANAGER: 'Project Manager',
  EMPLOYEE: 'Employee',

  // TimeLock Scope
  GLOBAL: 'Company-wide (Global)',
  JOB: 'Project Specific',
};

// Boolean field values mapping
export const BOOLEAN_LABELS = {
  is_active: { true: 'Active', false: 'Deactivated' },
  must_change_password: { true: 'Required', false: 'Not required' },
  is_locked: { true: 'Locked', false: 'Unlocked (Grace Window)' },
};

/**
 * Trả về tên hiển thị của phân hệ (table_name).
 */
export function getModuleLabel(tableName) {
  if (!tableName) return 'System Record';
  return MODULE_LABELS[tableName] || tableName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Trả về tên hiển thị của hành động (action).
 */
export function getActionLabel(action) {
  if (!action) return 'Activity Recorded';
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Trả về tên hiển thị của trường dữ liệu (field name).
 */
export function getFieldLabel(field) {
  if (!field) return '';
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Kiểm tra xem trường có phải trường ẩn không.
 */
export function isHiddenField(key) {
  return HIDDEN_FIELDS.has(key);
}

/**
 * Làm sạch chuỗi summary để hiển thị ngắn gọn, không bị dài dòng tên file hay timestamp.
 */
function sanitizeSummaryString(str) {
  if (!str) return '';
  // Rút gọn các tên file xuất report dài: (WorkTracker_TASK_SUMMARY_20260902_122539.xlsx) -> (XLSX)
  let clean = str.replace(/\((?:WorkTracker_)?([A-Za-z0-9_]+)\.(xlsx|pdf|csv)\)/gi, '($2)');
  // Rút gọn các chú thích trạng thái song ngữ dài: To Do (Cần làm) -> To Do
  clean = clean.replace(/\s*\([^)]*(?:làm|hiện|thành|tất|huỷ|kế hoạch)[^)]*\)/gi, '');
  return clean.trim();
}

/**
 * Tạo câu tóm tắt hành động ngắn gọn, chuẩn ngữ nghĩa nghiệp vụ người dùng.
 */
export function summarizeLog(log) {
  if (!log) return 'Activity recorded';
  if (log.summary && typeof log.summary === 'string' && log.summary.trim()) {
    return sanitizeSummaryString(log.summary);
  }

  const moduleLabel = getModuleLabel(log.table_name);
  const ref = log.record_id && log.record_id !== 0 ? ` #${log.record_id}` : '';
  const actor = log.actor_name || log.actor_email || 'User';

  switch (log.action) {
    case 'CREATE':
    case 'CREATE_TASK':
    case 'CREATE_JOB':
      return `${actor} created new ${moduleLabel}${ref}`;
    case 'UPDATE':
    case 'UPDATE_TASK':
    case 'UPDATE_JOB':
      return `${actor} updated ${moduleLabel}${ref}`;
    case 'DELETE':
      return `${actor} deleted ${moduleLabel}${ref}`;
    case 'REORDER_TASK':
      return `${actor} reordered Task${ref} on Kanban board`;
    case 'LOCK_ACCOUNT':
      return `${actor} locked user account${ref}`;
    case 'UNLOCK_ACCOUNT':
      return `${actor} unlocked user account${ref}`;
    case 'ROLE_CHANGED':
      return `${actor} changed role for user account${ref}`;
    case 'RESET_PASSWORD':
      return `${actor} reset password for user account${ref}`;
    case 'ASSIGN_ROLE':
      return `${actor} updated role permissions${ref}`;
    case 'EXPORT':
    case 'REPORT_EXPORTED': {
      const reportType = log.new_values?.report_type || moduleLabel;
      const fmt = log.new_values?.file_format || 'Excel';
      return `${actor} exported ${reportType} report (${fmt})`;
    }
    case 'LOCK_TIMESHEET':
      return `${actor} locked timesheet period${ref}`;
    case 'UNLOCK_TIMESHEET':
      return `${actor} unlocked timesheet period${ref}`;
    case 'UPDATE_TASK_STATUS':
    case 'UPDATE_JOB_STATUS':
    case 'APPROVE_TASK':
    case 'REJECT_TASK':
    case 'CANCEL_TASK':
    case 'RESTORE_TASK': {
      const from = log.old_values?.status;
      const to = log.new_values?.status;
      if (from && to) return `${actor} changed ${moduleLabel}${ref} status: ${formatAuditValue('status', from)} → ${formatAuditValue('status', to)}`;
      return `${actor} ${getActionLabel(log.action).toLowerCase()} ${moduleLabel}${ref}`;
    }
    case 'CREATE_LOG_WORK': {
      const hours = log.new_values?.hours_spent;
      return hours ? `${actor} logged ${hours}h work on Task${ref}` : `${actor} logged work hours on Task${ref}`;
    }
    case 'EDIT_LOG_WORK': {
      const fromHours = log.old_values?.hours_spent;
      const toHours = log.new_values?.hours_spent;
      if (fromHours != null && toHours != null && Number(fromHours) !== Number(toHours)) {
        return `${actor} adjusted work log: ${fromHours}h → ${toHours}h`;
      }
      return `${actor} edited work log${ref}`;
    }
    case 'VOID_LOG_WORK': {
      const reason = log.new_values?.adjustment_reason;
      return reason ? `${actor} voided work log${ref} · "${reason}"` : `${actor} voided work log${ref}`;
    }
    case 'APPROVE_LOG_WORK':
      return `${actor} approved work log${ref}`;
    case 'REJECT_LOG_WORK': {
      const reason = log.new_values?.review_note;
      return reason ? `${actor} rejected work log${ref} · "${reason}"` : `${actor} rejected work log${ref}`;
    }
    case 'CORRECT_LOG_WORK':
      return `${actor} corrected work log${ref}`;
    default:
      return `${actor} ${getActionLabel(log.action).toLowerCase()} on ${moduleLabel}${ref}`;
  }
}

/**
 * Đổi 1 giá trị thô trong old_values / new_values sang chuỗi nghiệp vụ dễ hiểu.
 */
export function formatAuditValue(key, value) {
  if (value === null || value === undefined || value === '') return null;

  // Xử lý riêng chỉ số sắp xếp Kanban LexoRank
  if (key === 'order_index') {
    return `Position Index (${value}) — Kanban Card Placement`;
  }

  // Xử lý số giờ làm việc
  if (key === 'hours_spent' || key === 'total_hours') {
    const num = Number(value);
    return !isNaN(num) ? `${num} hrs` : `${value} hrs`;
  }

  // Xử lý Boolean
  if (typeof value === 'boolean') {
    const map = BOOLEAN_LABELS[key];
    if (map) return map[String(value)];
    return value ? 'Yes' : 'No';
  }

  // Xử lý Foreign Key ID
  if (typeof value === 'number' && key.endsWith('_id')) {
    return `#${value}`;
  }

  // Xử lý Enum String & ISO Datetime
  if (typeof value === 'string') {
    if (VALUE_LABELS[value]) return VALUE_LABELS[value];
    // Chuỗi ISO datetime -> giờ + ngày
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${value.slice(0, 10)}`;
      }
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? 'None' : `${value.length} item(s)`;
  }

  if (typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([k, v]) => !isHiddenField(k) && v !== null && v !== '')
      .map(([k, v]) => `${getFieldLabel(k)}: ${formatAuditValue(k, v) || v}`);
    return parts.length ? parts.join(', ') : 'None';
  }

  return String(value);
}
