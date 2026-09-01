import { differenceInCalendarDays, format, parseISO } from "date-fns"

/**
 * "Aug 22, 2026" + "9 days overdue" / "Due in 3 days" / "Due today" — thuần
 * tính từ deadline (string ISO date), dùng chung cho mọi trang Employee
 * hiện deadline (My Tasks, Dashboard...) thay vì mỗi trang tự viết lại.
 */
export function describeDeadline(deadline) {
    if (!deadline) return null
    const days = differenceInCalendarDays(parseISO(deadline), new Date())
    const label = format(parseISO(deadline), "MMM d, yyyy")
    if (days < 0) return { label, relative: `${Math.abs(days)} day${days !== -1 ? "s" : ""} overdue`, tone: "overdue", daysOverdue: Math.abs(days) }
    if (days === 0) return { label, relative: "Due today", tone: "today", daysOverdue: 0 }
    return { label, relative: `Due in ${days} day${days !== 1 ? "s" : ""}`, tone: "upcoming", daysOverdue: 0 }
}

export const DEADLINE_TONE_STYLES = {
    overdue: "text-rose-600",
    today: "text-amber-600",
    upcoming: "text-slate-400",
}
