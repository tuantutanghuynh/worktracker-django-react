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
  TOKEN_REVOKED: 'Your session has expired. Please sign in again.',
  TOKEN_INVALID_EXPIRED: 'Your session has expired. Please sign in again.',
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
  JOB_NOT_ACTIVE_CANNOT_TRANSITION_TASK: 'Cannot transition task because its project is not in ACTIVE state (e.g. Planning, On Hold, or Completed). Please set the project to Active first.',
  CLIENT_DEACTIVATED_CANNOT_TRANSITION_TASK: 'Cannot transition task because the client associated with this project is currently inactive/deactivated.',
  TASK_LOCKED_FOR_REASSIGNMENT_EMPLOYEE_PHASE_OUT: 'This task is locked for reassignment because the assigned employee is currently in phase-out.',
  ASSIGNEE_NOT_IN_JOB_PROJECT_TEAM: 'Assignee must belong to this project team roster.',
  EMPLOYEE_IN_PHASE_OUT_CANNOT_RECEIVE_NEW_TASKS: 'Cannot assign new tasks to an employee undergoing project transfer (Phase-out).',
  MUST_ASSIGN_TO_EMPLOYEE_BEFORE_STARTING: 'Please assign this task to a team member before moving it to In Progress.',

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
  JOB_PERIOD_ALREADY_LOCKED: 'Timesheet period for this project is already locked.',
  JOB_PERIOD_NOT_LOCKED: 'Timesheet period for this project is not currently locked.',
  GLOBAL_PERIOD_ALREADY_LOCKED: 'This period is already locked company-wide.',
  GLOBAL_PERIOD_NOT_LOCKED: 'This period is not currently locked.',
  CANNOT_LOCK_ACTIVE_PERIOD: 'Cannot lock the current active period. You can only lock periods after the month has fully ended.',
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

// Câu do simplejwt sinh ra khi CHECK_REVOKE_TOKEN thấy hash mật khẩu trong
// token không khớp với hash trong DB. Đúng về mặt kỹ thuật nhưng vô nghĩa với
// người dùng: họ vừa bấm "Lock Period" chứ có đổi mật khẩu gì đâu. Thực chất
// phiên đăng nhập đã hỏng và họ cần đăng nhập lại.
const RAW_MESSAGE_OVERRIDES = {
  "The user's password has been changed.": 'Your session is no longer valid. Please sign in again.',
  'Given token not valid for any token type': 'Your session has expired. Please sign in again.',
  'Token is invalid or expired': 'Your session has expired. Please sign in again.',
  'User not found': 'Your session is no longer valid. Please sign in again.',
  'User is inactive': 'Your account has been deactivated. Contact an administrator.',
};

// Những khoá KHÔNG phải tên field — không được ghép "key: value" cho chúng.
// Đây chính là nguyên nhân toast từng hiện "detail: The user's password has
// been changed.": hàm cũ coi `detail` như tên một field.
const RESERVED_KEYS = new Set(['detail', 'non_field_errors', 'error', 'errors', 'message']);

// Thông báo mặc định theo mã HTTP, dùng khi body không nói gì hữu ích.
const STATUS_FALLBACK = {
  400: 'The submitted data is invalid. Please review the form and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  405: 'HTTP method not allowed for this endpoint.',
  409: 'This record was changed by someone else. Refresh the page and try again.',
  413: 'The uploaded file is too large.',
  423: 'This record is currently locked by another user.',
  429: 'Too many attempts. Please wait a minute and try again.',
  500: 'Something went wrong on the server. Please try again or contact support.',
  502: 'The server is unavailable right now. Please try again shortly.',
  503: 'The server is unavailable right now. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.',
};

// "client_name" -> "Client name" — hiện tên field cho người đọc, không phải
// tên cột trong database.
const prettifyField = (key) =>
  key
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/^./, (c) => c.toUpperCase());

// Lấy chuỗi đầu tiên có nghĩa từ một giá trị lỗi của DRF. DRF trả về nhiều
// hình dạng: chuỗi, mảng chuỗi, hoặc dict lồng cho serializer lồng nhau.
const firstString = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const found = firstString(value[key]);
      if (found) return found;
    }
    return null;
  }
  return null;
};

// Mã lỗi backend trông như ALL_CAPS_WITH_UNDERSCORES. Nếu không có trong từ
// điển thì đổi thành câu đọc được thay vì hiện nguyên mã cho người dùng.
const looksLikeErrorCode = (text) => /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(text.trim());
const humanizeCode = (code) =>
  code.trim().toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) + '.';

// Backend hay trả về dạng "MA_LOI: câu giải thích cho người đọc" — ví dụ
// "CANNOT_LOCK_ACTIVE_PERIOD: Period 9/2026 is currently in progress...".
// Phần sau dấu hai chấm mới là thứ người dùng cần, và nó còn cụ thể hơn câu
// trong từ điển vì có kèm số liệu thật (ngày kết thúc kỳ, tên dự án...).
const CODE_PREFIX = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*:\s*(.*)$/;

// Dịch một chuỗi bất kỳ từ backend sang câu hiển thị cho người dùng.
const translate = (text) => {
  const trimmed = text.trim();
  if (ERROR_DICTIONARY[trimmed]) return ERROR_DICTIONARY[trimmed];
  if (RAW_MESSAGE_OVERRIDES[trimmed]) return RAW_MESSAGE_OVERRIDES[trimmed];

  const khop = trimmed.match(CODE_PREFIX);
  if (khop) {
    const [, ma, phanConLai] = khop;
    // Có câu giải thích thì dùng nó — cụ thể hơn từ điển.
    if (phanConLai.trim()) return phanConLai.trim();
    // Chỉ có mã trần thì tra từ điển, cuối cùng mới tự chuyển thành câu.
    return ERROR_DICTIONARY[ma] || humanizeCode(ma);
  }

  if (looksLikeErrorCode(trimmed)) return humanizeCode(trimmed);
  return trimmed;
};

/**
 * Extracts human-readable error string from Axios error objects
 * @param {Error|Object} err - Axios error object
 * @param {string} [fallback] - Optional default message
 * @returns {string} Human-readable error message in English
 */
export const getErrorMessage = (err, fallback = ERROR_DICTIONARY.DEFAULT_ERROR) => {
  if (!err) return fallback;

  // 1. Không có phản hồi nào -> lỗi mạng, không phải lỗi nghiệp vụ.
  //    Phải kiểm tra TRƯỚC mọi thứ khác: khi máy chủ không chạy thì
  //    err.response là undefined và mọi bước đọc body bên dưới đều vô nghĩa.
  if (!err.response) {
    if (err.code === 'ECONNABORTED' || err.message === 'timeout') {
      return 'The server took too long to respond. Please try again.';
    }
    if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
      return 'Unable to reach the server. Check your connection and make sure the backend is running.';
    }
    return fallback;
  }

  const status = err.response.status;
  const data = err.response.data;

  // 2. Body là chuỗi thuần (thường là trang lỗi HTML của Django khi DEBUG=False).
  //    Không đổ nguyên HTML ra toast.
  if (typeof data === 'string') {
    const isHtml = data.trim().startsWith('<');
    return isHtml ? STATUS_FALLBACK[status] || fallback : translate(data);
  }

  if (data && typeof data === 'object') {
    // 3. 429 — DRF trả "Request was throttled. Expected available in N
    //    seconds." Giữ lại con số giây vì đó là thứ người dùng cần biết,
    //    nhưng viết lại cho dễ hiểu thay vì dùng chữ "throttled".
    if (status === 429) {
      const detail429 = firstString(data.detail) || '';
      const giay = detail429.match(/(\d+)\s*second/i);
      return giay
        ? `Too many attempts. Please wait ${giay[1]} seconds and try again.`
        : STATUS_FALLBACK[429];
    }

    // 4. `detail` — khoá chuẩn của DRF cho lỗi cấp request.
    //    Xử lý TRƯỚC lỗi cấp field, nếu không nó sẽ bị ghép thành
    //    "detail: ..." như bug cũ.
    const detail = firstString(data.detail);
    if (detail) return translate(detail);

    // 5. non_field_errors — lỗi của serializer không thuộc field nào.
    const nonField = firstString(data.non_field_errors);
    if (nonField) return translate(nonField);

    // 6. Lỗi theo từng field. Bỏ qua các khoá dành riêng ở trên.
    for (const key of Object.keys(data)) {
      if (RESERVED_KEYS.has(key)) continue;
      const message = firstString(data[key]);
      if (!message) continue;

      const translated = translate(message);
      // Backend đã nói rõ tên field trong câu rồi thì không lặp lại.
      if (translated.toLowerCase().includes(key.replace(/_/g, ' ').toLowerCase())) {
        return translated;
      }
      return `${prettifyField(key)}: ${translated}`;
    }
  }

  // 7. Body rỗng hoặc không đọc được -> dựa vào mã HTTP.
  return STATUS_FALLBACK[status] || fallback;
};

export default getErrorMessage;
