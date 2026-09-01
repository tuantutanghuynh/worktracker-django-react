// 1 task được coi là "frozen" (đông cứng) khi dự án của nó không còn ACTIVE
// (vd. ON_HOLD, CANCELLED...) hoặc Client của dự án đã bị Admin vô hiệu hóa —
// backend (task_transition_manager_service.validate_transition, nhánh của
// Long) đã thật sự CHẶN mọi status transition trong 2 trường hợp này; ở đây
// chỉ tái dùng đúng công thức đó để hiển thị đúng UI, không tự nghĩ thêm.
//
// Dùng chung ở My Tasks (bảng + drawer) và Dashboard (Upcoming Tasks) — tách
// ra utils để 2 nơi luôn tính đúng 1 công thức, không tự viết lại rồi lệch
// nhau theo thời gian.
export function isTaskFrozen(task) {
    if (!task) return false
    return (task.job_status && task.job_status !== "ACTIVE") || task.job_client_is_active === false
}

// Task còn việc dang dở (TODO/IN_PROGRESS/REVIEWING) mà đang frozen — task đã
// COMPLETED/CANCELLED thì dù job có frozen cũng không còn hành động nào bị
// chặn, không cần xếp vào tab/badge Frozen.
const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "REVIEWING"]
export function isFrozenOpenTask(task) {
    if (!task) return false
    return OPEN_STATUSES.includes(task.status) && isTaskFrozen(task)
}
