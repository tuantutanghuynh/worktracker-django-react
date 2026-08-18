import { useState, useMemo } from "react"
import { useTimesheet } from "../../hooks/queries/employee/useTimesheet"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import QuickLogWorkFormCard from "../../components/common/forms/QuickLogWorkFormCard"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"

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

// Employee Timesheet (Ngày 8) — Quick Log form + list of the caller's
// own log_work history + Void. Month filter is client-side (list
// endpoint doesn't take query params, dataset per user is small — same
// choice already made for My Tasks).
export function TimesheetPage() {
    const { entries, loading, error, submitting, submitLogWork, submitVoidLogWork } = useTimesheet()
    const { tasks } = useMyTasks()

    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [monthValue, setMonthValue] = useState("")
    const [voidingId, setVoidingId] = useState(null)

    const monthOptions = useMemo(() => {
        const months = new Set(entries.map((e) => e.work_date.slice(0, 7)))
        return Array.from(months).sort().reverse()
    }, [entries])

    const filteredEntries = useMemo(() => {
        return entries.filter((e) => {
            if (statusValue && e.review_status !== statusValue) return false
            if (monthValue && !e.work_date.startsWith(monthValue)) return false
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                const matchesDesc = e.description?.toLowerCase().includes(q)
                const matchesTask = e.task?.title?.toLowerCase().includes(q)
                if (!matchesDesc && !matchesTask) return false
            }
            return true
        })
    }, [entries, searchQuery, statusValue, monthValue])

    const todayHours = useMemo(() => {
        return entries
            .filter((e) => e.work_date === today && e.review_status !== "VOIDED")
            .reduce((sum, e) => sum + Number(e.hours_spent), 0)
    }, [entries])

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setMonthValue("")
    }

    async function handleQuickLog({ task_id, work_date, hours_spent, description }) {
        await submitLogWork({ task: task_id, work_date, hours_spent, description })
    }

    async function handleConfirmVoid(reason) {
        if (!voidingId) return
        const ok = await submitVoidLogWork(voidingId, reason)
        if (ok) setVoidingId(null)
    }

    const columns = [
        { accessorKey: "work_date", header: "Work Date" },
        { accessorKey: "task_title", header: "Task", cell: (info) => info.row.original.task?.title },
        { accessorKey: "job_name", header: "Job / Project", cell: (info) => info.row.original.task?.job_name },
        { accessorKey: "hours_spent", header: "Hours", cell: (info) => `${info.row.original.hours_spent}h` },
        { accessorKey: "description", header: "Description" },
        {
            accessorKey: "review_status",
            header: "Status",
            cell: (info) => <ReviewStatusBadge status={info.row.original.review_status} />,
        },
        {
            accessorKey: "action",
            header: "Action",
            cell: (info) => {
                const entry = info.row.original
                if (entry.review_status !== "PENDING") return <span className="text-xs text-slate-400">—</span>
                return (
                    <button
                        type="button"
                        onClick={() => setVoidingId(entry.id)}
                        className="px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                    >
                        Void
                    </button>
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
            </FilterToolbar>

            <DataTable
                columns={columns}
                data={filteredEntries}
                isLoading={loading}
                emptyMessage="No timesheet entries yet."
            />

            <PromptReasonModal
                isOpen={Boolean(voidingId)}
                onClose={() => setVoidingId(null)}
                onConfirm={handleConfirmVoid}
                title="Void Log Work"
                description="This entry will be excluded from your daily total. This cannot be undone."
                confirmText="Void Entry"
                isLoading={submitting}
            />
        </div>
    )
}
