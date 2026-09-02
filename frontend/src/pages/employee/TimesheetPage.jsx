import { useState, useMemo } from "react"
import { List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { startOfWeek, addWeeks, addDays, eachDayOfInterval, format, isToday, parseISO } from "date-fns"
import { useTimesheet } from "../../hooks/queries/employee/useTimesheet"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import { ViewToggle } from "../../components/common/table/ViewToggle"
import QuickLogWorkFormCard from "../../components/common/forms/QuickLogWorkFormCard"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"
import EditLogWorkModal from "../../components/employee/EditLogWorkModal"


const REVIEW_STATUS_STYLES = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-600 border-rose-200",
    VOIDED: "bg-slate-100 text-slate-500 border-slate-200",
}

function ReviewStatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${REVIEW_STATUS_STYLES[status]}`}>
            {status}
        </span>
    )
}

const STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "VOIDED", label: "Voided" },
]

const today = new Date().toISOString().split("T")[0]

// 6 ngày làm việc/tuần × 8h — khớp WORK_DAYS_PER_WEEK/DAILY_WORKING_HOURS
// trong backend/.env (giá trị hiện tại: 6, 8). Backend chưa expose 2 số này
// qua API nào cho Employee nên tạm hardcode ở đây, không phải 40h kiểu
// tuần làm việc 5 ngày mặc định của nhiều hệ thống khác.
const EXPECTED_WEEKLY_HOURS = 48


// Employee Timesheet (Ngày 8) — Quick Log form + list of the caller's
// own log_work history + Void. Month filter is client-side (list
// endpoint doesn't take query params, dataset per user is small — same
// choice already made for My Tasks).
export function TimesheetPage() {
    const { entries, loading, error, submitting, submitLogWork, submitVoidLogWork, submitEditLogWork } = useTimesheet()
    const { tasks } = useMyTasks()

    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [monthValue, setMonthValue] = useState("")
    const [projectValue, setProjectValue] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [voidingId, setVoidingId] = useState(null)
    const [editingEntry, setEditingEntry] = useState(null)

    const monthOptions = useMemo(() => {
        const months = new Set(entries.map((e) => e.work_date.slice(0, 7)))
        return Array.from(months).sort().reverse()
    }, [entries])

    const projectOptions = useMemo(() => {
        const seen = new Set()
        return entries
            .filter((e) => e.task?.job_name && !seen.has(e.task.job_name) && seen.add(e.task.job_name))
            .map((e) => e.task.job_name)
    }, [entries])

    const filteredEntries = useMemo(() => {
        return entries.filter((e) => {
            if (statusValue && e.review_status !== statusValue) return false
            if (monthValue && !e.work_date.startsWith(monthValue)) return false
            if (projectValue && e.task?.job_name !== projectValue) return false
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                const matchesDesc = e.description?.toLowerCase().includes(q)
                const matchesTask = e.task?.title?.toLowerCase().includes(q)
                if (!matchesDesc && !matchesTask) return false
            }
            return true
        })
    }, [entries, searchQuery, statusValue, monthValue, projectValue])

    const totalItems = filteredEntries.length
    const totalPages = Math.ceil(totalItems / pageSize) || 1
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filteredEntries.slice(start, start + pageSize)
    }, [filteredEntries, currentPage, pageSize])

    const todayHours = useMemo(() => {
        return entries
            .filter((e) => e.work_date === today && e.review_status !== "VOIDED")
            .reduce((sum, e) => sum + Number(e.hours_spent), 0)
    }, [entries])

    const [view, setView] = useState("list")
    const [weekOffset, setWeekOffset] = useState(0)

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setMonthValue("")
        setProjectValue("")
        setCurrentPage(1)
    }

    async function handleQuickLog({ task_id, work_date, hours_spent, description }) {
        await submitLogWork({ task: task_id, work_date, hours_spent, description })
    }

    async function handleConfirmVoid(reason) {
        if (!voidingId) return
        const ok = await submitVoidLogWork(voidingId, reason)
        if (ok) setVoidingId(null)
    }

    async function handleConfirmEdit(hoursSpent, description, reason) {
        if (!editingEntry) return
        const ok = await submitEditLogWork(editingEntry.id, hoursSpent, description, reason)
        if (ok) setEditingEntry(null)
    }

    const columns = [
        { accessorKey: "work_date", header: "Work Date" },
        { accessorKey: "task_title", header: "Task", cell: (info) => info.row.original.task?.title },
        { accessorKey: "job_name", header: "Job / Project", cell: (info) => info.row.original.task?.job_name },
        { accessorKey: "hours_spent", header: "Hours", cell: (info) => `${info.row.original.hours_spent}h` },
        {
            accessorKey: "description",
            header: "Description",
            className: "max-w-[200px] truncate",
            cell: (info) => <span title={info.row.original.description}>{info.row.original.description}</span>,
        },
        {
            accessorKey: "review_status",
            header: "Status",
            cell: (info) => {
                const entry = info.row.original
                return (
                    <div className="space-y-0.5">
                        <ReviewStatusBadge status={entry.review_status} />
                        {entry.review_status === "REJECTED" && entry.review_note && (
                            <p className="text-[10px] text-rose-600 max-w-[160px]" title={entry.review_note}>
                                {entry.review_note}
                            </p>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "action",
            header: "Action",
            cell: (info) => {
                const entry = info.row.original
                if (entry.review_status !== "PENDING") return <span className="text-xs text-slate-400">—</span>
                return (
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => setEditingEntry(entry)}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => setVoidingId(entry.id)}
                            className="px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                        >
                            Void
                        </button>
                    </div>
                )
            },
        },
    ]

    if (error) {
        return <p className="text-xs text-rose-500">{error}</p>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Timesheet</h1>
                <p className="text-slate-500 text-xs">Log your work hours and track your submission history.</p>
            </div>

            <QuickLogWorkFormCard
                tasks={tasks}
                dailyHoursLogged={todayHours}
                onSubmit={handleQuickLog}
                isLoading={submitting}
            />

            <WeeklySummary entries={entries} />

            <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                    {view === "list" && (
                        <FilterToolbar
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            searchPlaceholder="Search log description or task..."
                            statusValue={statusValue}
                            onStatusChange={setStatusValue}
                            statusOptions={STATUS_OPTIONS}
                            onClearFilters={handleClearFilters}
                        >
                            <select
                                value={monthValue}
                                onChange={(e) => setMonthValue(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Months</option>
                                {monthOptions.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            {projectOptions.length > 0 && (
                                <select
                                    value={projectValue}
                                    onChange={(e) => setProjectValue(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Projects</option>
                                    {projectOptions.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            )}
                        </FilterToolbar>
                    )}
                </div>
                <ViewToggle
                    views={[
                        { value: "list", label: "List View", icon: List },
                        { value: "week", label: "Week View", icon: CalendarDays },
                    ]}
                    activeView={view}
                    onChange={setView}
                />
            </div>

            {view === "list" ? (
                <DataTable
                    columns={columns}
                    data={paginatedEntries}
                    isLoading={loading}
                    emptyMessage="No timesheet entries yet."
                    pagination={{
                        currentPage,
                        totalPages,
                        totalItems,
                        pageSize,
                        pageSizeOptions: [10, 25, 50],
                        onPageChange: setCurrentPage,
                        onPageSizeChange: (size) => {
                            setPageSize(size)
                            setCurrentPage(1)
                        },
                    }}
                />
            ) : (
                <WeekView
                    entries={entries}
                    weekOffset={weekOffset}
                    onPrevWeek={() => setWeekOffset((w) => w - 1)}
                    onNextWeek={() => setWeekOffset((w) => w + 1)}
                    onThisWeek={() => setWeekOffset(0)}
                    onVoid={setVoidingId}
                    onEdit={setEditingEntry}
                />
            )}

            <PromptReasonModal
                isOpen={Boolean(voidingId)}
                onClose={() => setVoidingId(null)}
                onConfirm={handleConfirmVoid}
                title="Void Log Work"
                description="This entry will be excluded from your daily total. This cannot be undone."
                confirmText="Void Entry"
                isLoading={submitting}
            />

            <EditLogWorkModal
                key={editingEntry?.id ?? "none-edit"}
                isOpen={Boolean(editingEntry)}
                logWork={editingEntry}
                onClose={() => setEditingEntry(null)}
                onConfirm={handleConfirmEdit}
                isLoading={submitting}
            />
        </div>
    )
}

// Tổng quan tuần hiện tại — tính hoàn toàn từ entries đã tải sẵn (giống
// todayHours), không gọi API mới. Tuần bắt đầu Thứ 2, khớp cách backend
// định nghĩa "tuần" ở PersonalKPIView (hours_logged_this_week) và cách
// WeekView bên dưới đang nhóm ngày.
function WeeklySummary({ entries }) {
    const summary = useMemo(() => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start, end: addDays(start, 6) })

        const activeThisWeek = entries.filter((e) => {
            const d = parseISO(e.work_date)
            return d >= start && d <= addDays(start, 6) && e.review_status !== "VOIDED"
        })

        const total = activeThisWeek.reduce((sum, e) => sum + Number(e.hours_spent), 0)
        const byStatus = { APPROVED: 0, PENDING: 0, REJECTED: 0 }
        for (const e of activeThisWeek) {
            if (e.review_status in byStatus) byStatus[e.review_status] += Number(e.hours_spent)
        }

        const perDay = days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const hours = activeThisWeek
                .filter((e) => e.work_date === dateStr)
                .reduce((sum, e) => sum + Number(e.hours_spent), 0)
            return { label: format(day, "EEE"), hours }
        })

        return {
            total,
            byStatus,
            perDay,
            missing: Math.max(EXPECTED_WEEKLY_HOURS - total, 0),
            pct: Math.min(Math.round((total / EXPECTED_WEEKLY_HOURS) * 100), 100),
        }
    }, [entries])

    return (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">This Week</p>
                <p className="text-xs font-bold text-slate-700">
                    {summary.total}h <span className="text-slate-400 font-normal">/ {EXPECTED_WEEKLY_HOURS}h</span>
                </p>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${summary.pct}%` }}
                />
            </div>

            <div className="grid grid-cols-7 gap-2 pt-1">
                {summary.perDay.map((d) => (
                    <div key={d.label} className="text-center">
                        <p className="text-[10px] text-slate-400">{d.label}</p>
                        <p className="text-xs font-bold text-slate-700">{d.hours || "—"}{d.hours ? "h" : ""}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span>Approved <strong className="text-emerald-600">{summary.byStatus.APPROVED}h</strong></span>
                <span>Pending <strong className="text-amber-600">{summary.byStatus.PENDING}h</strong></span>
                <span>Rejected <strong className="text-rose-600">{summary.byStatus.REJECTED}h</strong></span>
                {summary.missing > 0 && (
                    <span className="ml-auto text-slate-400">{summary.missing}h remaining</span>
                )}
            </div>
        </div>
    )
}

// Week View — nhóm entries đã tải sẵn theo ngày (không gọi API mới).
// Tuần bắt đầu Thứ 2, khớp cách backend định nghĩa "tuần" ở
// PersonalKPIView (hours_logged_this_week).
function WeekView({ entries, weekOffset, onPrevWeek, onNextWeek, onThisWeek, onVoid, onEdit }) {
    const { days, entriesByDay } = useMemo(() => {
        const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset)
        const daysList = eachDayOfInterval({ start, end: addDays(start, 6) })
        const map = {}
        for (const day of daysList) map[format(day, "yyyy-MM-dd")] = []
        for (const e of entries) {
            if (map[e.work_date]) map[e.work_date].push(e)
        }
        return { days: daysList, entriesByDay: map }
    }, [entries, weekOffset])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onPrevWeek} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-semibold text-slate-700">
                        {format(days[0], "d MMM")} – {format(days[6], "d MMM yyyy")}
                    </span>
                    <button type="button" onClick={onNextWeek} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <ChevronRight size={16} />
                    </button>
                </div>
                {weekOffset !== 0 && (
                    <button type="button" onClick={onThisWeek} className="text-xs font-semibold text-blue-600 hover:underline">
                        This Week
                    </button>
                )}
            </div>

            <div className="grid grid-cols-7 gap-3">
                {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const dayEntries = entriesByDay[dateStr] ?? []
                    const totalHours = dayEntries
                        .filter((e) => e.review_status !== "VOIDED")
                        .reduce((sum, e) => sum + Number(e.hours_spent), 0)

                    return (
                        <div
                            key={dateStr}
                            className={`rounded-xl border p-2.5 space-y-2 min-h-[160px] ${
                                isToday(day) ? "border-blue-300 bg-blue-50/40" : "border-slate-200/80 bg-white"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700">{format(day, "EEE d")}</p>
                                <p className="text-[11px] text-slate-400">{totalHours}h</p>
                            </div>
                            {dayEntries.map((e) => (
                                <div key={e.id} className="rounded-lg bg-slate-50 border border-slate-200/80 p-2 space-y-1">
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{e.task?.title}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">{e.hours_spent}h</span>
                                        <ReviewStatusBadge status={e.review_status} />
                                    </div>
                                    {e.review_status === "REJECTED" && e.review_note && (
                                        <p className="text-[10px] text-rose-600">{e.review_note}</p>
                                    )}
                                    {e.review_status === "PENDING" && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(e)}
                                                className="text-[10px] font-semibold text-blue-500 hover:text-blue-600"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onVoid(e.id)}
                                                className="text-[10px] font-semibold text-rose-500 hover:text-rose-600"
                                            >
                                                Void
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
