/**
 * Dịch mọi mã kỹ thuật trong Audit Log sang ngôn ngữ nghiệp vụ.
 *
 * Audit Log được ghi bằng tên bảng / tên cột / mã action trong DB — chuẩn
 * cho dev đọc, nhưng Admin nghiệp vụ nhìn "employee_profiles.department_id"
 * thì không hiểu gì. Mọi chỗ hiển thị audit (bảng danh sách + drawer chi
 * tiết) đều đi qua các hàm ở đây để chỉ hiện thứ người dùng đọc được.
 */

// table_name (tên bảng vật lý) -> tên module người dùng biết
export const MODULE_LABELS = {
  users: 'User Accounts',
  employee_profiles: 'Employee Profiles',
  departments: 'Departments',
  roles: 'Roles',
  role_permissions: 'Role Permissions',
  clients: 'Clients',
  jobs: 'Jobs',
  tasks: 'Tasks',
  log_works: 'Work Logs',
  timesheets: 'Timesheets',
  daily_user_timesheets: 'Daily Timesheets',
  time_locks: 'Timesheet Locks',
  reports: 'Reports',
  audit_logs: 'Audit Logs',
  notifications: 'Notifications',
};

// Mã action -> câu mô tả người dùng hiểu được
export const ACTION_LABELS = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOCK_ACCOUNT: 'Locked account',
  UNLOCK_ACCOUNT: 'Unlocked account',
  ROLE_CHANGED: 'Changed role',
  RESET_PASSWORD: 'Reset password',
  CHANGE_PASSWORD: 'Changed password',
  ASSIGN_ROLE: 'Updated permissions',
  EXPORT: 'Exported report',
  REPORT_EXPORTED: 'Exported report',
  LOCK_TIMESHEET: 'Locked timesheet period',
  UNLOCK_TIMESHEET: 'Unlocked timesheet period',
  CREATE_JOB: 'Created project',
  UPDATE_JOB: 'Updated project',
  UPDATE_JOB_STATUS: 'Changed project status',
  // Task lifecycle (tasks/services/task_manager_service.py,
  // task_transition_manager_service.py) — trước đây leak thẳng action code
  // lên UI Employee vì trang đó chưa dùng auditLabels.js.
  CREATE_TASK: 'Created task',
  UPDATE_TASK: 'Updated task',
  UPDATE_TASK_STATUS: 'Changed task status',
  REORDER_TASK: 'Reordered task',
  UPLOAD_TASK_ATTACHMENT: 'Uploaded attachment',
  APPROVE_TASK: 'Approved task',
  REJECT_TASK: 'Rejected task',
  CANCEL_TASK: 'Cancelled task',
  RESTORE_TASK: 'Restored task',
  AUTO_RELEASE_EMPLOYEE: 'Released from project',
  // Log work lifecycle (timesheets/employee/, timesheets/services/logwork_review_manager_service.py)
  CREATE_LOG_WORK: 'Created work log',
  EDIT_LOG_WORK: 'Edited work log',
  VOID_LOG_WORK: 'Voided work log',
  APPROVE_LOG_WORK: 'Approved work log',
  REJECT_LOG_WORK: 'Rejected work log',
  CORRECT_LOG_WORK: 'Corrected work log',
};

// Tên cột trong DB -> nhãn hiển thị
export const FIELD_LABELS = {
  email: 'Email',
  full_name: 'Full name',
  phone_number: 'Phone number',
  is_active: 'Account status',
  must_change_password: 'Force password change',
  role: 'Role',
  role_id: 'Role',
  department: 'Department',
  department_id: 'Department',
  manager: 'Manager',
  manager_id: 'Manager',
  avatar_url: 'Avatar',
  joined_date: 'Joined date',
  client_name: 'Client name',
  tax_code: 'Tax code',
  contact_person: 'Contact person',
  contact_email: 'Contact email',
  contact_phone: 'Contact phone',
  address: 'Address',
  industry: 'Industry',
  notes: 'Notes',
  job_name: 'Job name',
  job_code: 'Job code',
  status: 'Status',
  priority: 'Priority',
  start_date: 'Start date',
  deadline: 'Deadline',
  description: 'Description',
  hours_spent: 'Hours spent',
  work_date: 'Work date',
  review_status: 'Review status',
  review_note: 'Review note',
  adjustment_reason: 'Adjustment reason',
  total_hours: 'Total hours',
  lock_month: 'Locked month',
  lock_year: 'Locked year',
  lock_reason: 'Lock reason',
  unlock_reason: 'Unlock reason',
  is_locked: 'Lock status',
  lock_scope: 'Lock scope',
  name: 'Name',
  code: 'Code',
  permission_ids: 'Permissions',
  filters: 'Filters applied',
  row_count: 'Rows exported',
};

// Những cột thuần kỹ thuật — Admin không cần thấy, chỉ gây nhiễu.
const HIDDEN_FIELDS = new Set([
  'id',
  'pk',
  'password',
  'created_at',
  'updated_at',
  'last_login',
  'order_index',
  'is_superuser',
  'is_staff',
  'profile',
  'role_detail',
  'locked_at',
  'unlocked_at',
  'reviewed_at',
  'adjusted_at',
]);

// Giá trị enum -> chữ dễ đọc
const VALUE_LABELS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  REVIEWING: 'Reviewing',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  VOIDED: 'Voided',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  GLOBAL: 'Company-wide',
  JOB: 'Single job',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

// Vài cột boolean có nghĩa riêng, hiện true/false sẽ khó hiểu.
const BOOLEAN_LABELS = {
  is_active: { true: 'Active', false: 'Locked' },
  is_locked: { true: 'Locked', false: 'Unlocked' },
  must_change_password: { true: 'Required', false: 'Not required' },
  is_read: { true: 'Read', false: 'Unread' },
};

export function getModuleLabel(tableName) {
  if (!tableName) return '—';
  if (MODULE_LABELS[tableName]) return MODULE_LABELS[tableName];
  // Bảng lạ (hoặc dữ liệu demo có tiền tố) — đổi snake_case thành Title Case
  return tableName
    .replace(/^demo_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getActionLabel(action) {
  return ACTION_LABELS[action] || action;
}

export function getFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_id$/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function isHiddenField(key) {
  return HIDDEN_FIELDS.has(key);
}

/**
 * Câu tóm tắt 1 dòng, viết như người nói: "Locked user account #12".
 * AuditLog.summary có sẵn trên model nhưng log_audit_event() (dùng chung 3
 * nhánh) không điền, nên tự dựng từ các cột luôn có.
 */
export function summarizeLog(log) {
  if (log.summary) return log.summary;

  const moduleLabel = getModuleLabel(log.table_name);
  const ref = log.record_id && log.record_id !== 0 ? ` #${log.record_id}` : '';

  switch (log.action) {
    case 'CREATE':
      return `Created a new ${moduleLabel} record`;
    case 'UPDATE':
      return `Updated ${moduleLabel}${ref}`;
    case 'DELETE':
      return `Deleted ${moduleLabel}${ref}`;
    case 'LOCK_ACCOUNT':
      return `Locked user account${ref}`;
    case 'UNLOCK_ACCOUNT':
      return `Unlocked user account${ref}`;
    case 'ROLE_CHANGED':
      return `Changed role for user account${ref}`;
    case 'RESET_PASSWORD':
      return `Reset password for user account${ref}`;
    case 'ASSIGN_ROLE':
      return `Updated permissions for role${ref}`;
    case 'EXPORT':
      return `Exported ${moduleLabel} to Excel`;
    case 'LOCK_TIMESHEET':
      return `Locked timesheet period${ref}`;
    case 'UNLOCK_TIMESHEET':
      return `Unlocked timesheet period${ref}`;
    // Task status transitions — cùng 1 hình dạng old.status -> new.status
    // cho mọi action đổi trạng thái Task (apply_transition() luôn ghi
    // {status: locked_task.status} vào new_values, và snapshot() cũ vào
    // old_values trước khi đổi).
    case 'UPDATE_TASK_STATUS':
    case 'APPROVE_TASK':
    case 'REJECT_TASK':
    case 'CANCEL_TASK':
    case 'RESTORE_TASK': {
      const from = log.old_values?.status;
      const to = log.new_values?.status;
      if (from && to) return `${formatAuditValue('status', from)} → ${formatAuditValue('status', to)}`;
      return `${getActionLabel(log.action)}${ref}`;
    }
    case 'CREATE_LOG_WORK': {
      const hours = log.new_values?.hours_spent;
      return hours ? `Logged ${hours}h` : `Created work log${ref}`;
    }
    case 'EDIT_LOG_WORK': {
      const fromHours = log.old_values?.hours_spent;
      const toHours = log.new_values?.hours_spent;
      // Backend serialize không nhất quán kiểu dữ liệu (cũ ra string
      // '0.50', mới ra number 0.75) — so bằng Number() để không báo nhầm
      // "đã đổi" khi giá trị thật giống nhau, chỉ khác kiểu.
      if (fromHours != null && toHours != null && Number(fromHours) !== Number(toHours)) {
        return `${fromHours}h → ${toHours}h`;
      }
      return `Edited work log${ref}`;
    }
    case 'VOID_LOG_WORK': {
      const reason = log.new_values?.adjustment_reason;
      return reason ? `Voided · "${reason}"` : `Voided work log${ref}`;
    }
    case 'REJECT_LOG_WORK': {
      const reason = log.new_values?.review_note;
      return reason ? `Rejected · "${reason}"` : `Rejected work log${ref}`;
    }
    default:
      return `${getActionLabel(log.action)} · ${moduleLabel}${ref}`;
  }
}

/**
 * Đổi 1 giá trị thô trong old_values/new_values sang chuỗi đọc được.
 * Trả về null nếu không có giá trị (để component tự hiển thị dấu "—").
 */
export function formatAuditValue(key, value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'boolean') {
    const map = BOOLEAN_LABELS[key];
    if (map) return map[String(value)];
    return value ? 'Yes' : 'No';
  }

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
    // Object lồng (vd filters của export) — liệt kê gọn thành "key: value"
    const parts = Object.entries(value)
      .filter(([k, v]) => !isHiddenField(k) && v !== null && v !== '')
      .map(([k, v]) => `${getFieldLabel(k)}: ${v}`);
    return parts.length ? parts.join(', ') : 'None';
  }

  return String(value);
}
