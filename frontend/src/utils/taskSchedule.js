// task.start_date — ngày Manager lên lịch cho task bắt đầu, chỉ sửa được
// khi task còn TODO (khóa lại khi đã IN_PROGRESS/REVIEWING, xem
// task_manager_service.py). Khác hẳn 2 khái niệm "tương lai" khác đã có
// trong dự án:
// - "Frozen" (utils/taskFrozen.js) — vấn đề ở JOB (on hold/client khóa),
//   không liên quan lịch trình riêng của task.
// - Dashboard's "Upcoming Tasks" — sắp XẾP theo deadline gần nhất của
//   task đang mở, không phải task CHƯA TỚI ngày bắt đầu.
// Đây là: task còn TODO, Manager đã hẹn ngày bắt đầu SAU hôm nay — nhân
// viên chưa cần quan tâm/xử lý ngay, tách khỏi tab Active cho gọn.
export function isUpcomingTask(task) {
    if (!task) return false
    if (task.status !== "TODO") return false
    if (!task.start_date) return false

    const today = new Date().toISOString().split("T")[0]
    return task.start_date > today
}
