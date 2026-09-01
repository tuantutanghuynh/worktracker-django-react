import { useState, useMemo } from "react"
import { format, parseISO, isToday, isYesterday, subDays } from "date-fns"
import { useAuditLog } from "../../hooks/queries/employee/useAuditLog"
import { useAuth } from "../../hooks/useAuth"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import SeverityBadge from "../../components/common/badges/SeverityBadge"
import SideDrawer from "../../components/common/drawer/SideDrawer"
import AuditDiffViewer from "../../components/common/drawer/AuditDiffViewer"
import { getErrorMessage } from "../../utils/errorMessages"
import { getActionLabel, getModuleLabel, summarizeLog } from "../../utils/auditLabels"

const SEVERITY_OPTIONS = [
    { value: "NORMAL", label: "Normal" },
    { value: "WARNING", label: "Warning" },
    { value: "CRITICAL", label: "Critical" },
]

const DATE_OPTIONS = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
]

// Trên trang CỦA CHÍNH Employee, REJECT_TASK luôn là do chính họ tự recall
// bài nộp (Manager reject sẽ ghi audit dưới user=Manager, không xuất hiện
// ở đây vì backend đã lọc user=request.user) — nhãn chung "Rejected task"
// trong auditLabels.js đúng cho góc nhìn hệ thống/Admin, nhưng gây hiểu
// lầm ở đúng trang này ("tôi tự reject task của mình"?).
function describeEmployeeAction(log) {
    if (log.action === "REJECT_TASK") return "Recalled submission"
    return getActionLabel(log.action)
}

function formatTimestamp(iso) {
    const d = parseISO(iso)
    if (isToday(d)) return `Today · ${format(d, "HH:mm")}`
    if (isYesterday(d)) return `Yesterday · ${format(d, "HH:mm")}`
    return format(d, "MMM d · HH:mm")
}

// Employee's own activity history — audit_logs scoped to user=me only,
// not a system-wide view (that's Admin) or team view (that's Manager).
export function EmployeeAuditLogsPage() {
    const { data: logs, isLoading: loading, error } = useAuditLog()
    const { user } = useAuth()
    const [searchQuery, setSearchQuery] = useState("")
    const [severityValue, setSeverityValue] = useState("")
    const [actionValue, setActionValue] = useState("")
    const [dateValue, setDateValue] = useState("")
    const [selectedLog, setSelectedLog] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    const actionOptions = useMemo(() => {
        const seen = new Set()
        return (logs ?? [])
            .filter((l) => l.action && !seen.has(l.action) && seen.add(l.action))
            .map((l) => ({ value: l.action, label: getActionLabel(l.action) }))
            .sort((a, b) => a.label.localeCompare(b.label))
    }, [logs])

    const filteredLogs = useMemo(() => {
        return (logs ?? []).filter((log) => {
            if (severityValue && log.severity !== severityValue) return false
            if (actionValue && log.action !== actionValue) return false
            if (dateValue) {
                const logDate = parseISO(log.created_at)
                if (dateValue === "today" && !isToday(logDate)) return false
                if (dateValue === "7d" && logDate < subDays(new Date(), 7)) return false
                if (dateValue === "30d" && logDate < subDays(new Date(), 30)) return false
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                const matchesSummary = summarizeLog(log)?.toLowerCase().includes(q)
                const matchesAction = describeEmployeeAction(log)?.toLowerCase().includes(q)
                const matchesResource = getModuleLabel(log.table_name)?.toLowerCase().includes(q)
                if (!matchesSummary && !matchesAction && !matchesResource) return false
            }
            return true
        })
    }, [logs, searchQuery, severityValue, actionValue, dateValue])

    const totalPages = Math.max(Math.ceil(filteredLogs.length / pageSize), 1)
    const effectivePage = Math.min(currentPage, totalPages)
    const paginatedLogs = filteredLogs.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

    function handleClearFilters() {
        setSearchQuery("")
        setSeverityValue("")
        setActionValue("")
        setDateValue("")
        setCurrentPage(1)
    }

    const columns = [
        {
            accessorKey: "created_at",
            header: "Timestamp",
            className: "whitespace-nowrap",
            cell: (info) => (
                <span title={format(parseISO(info.row.original.created_at), "PPpp")}>
                    {formatTimestamp(info.row.original.created_at)}
                </span>
            ),
        },
        {
            accessorKey: "action",
            header: "Activity",
            cell: (info) => {
                const log = info.row.original
                return (
                    <div>
                        <p className="font-semibold text-slate-800">{describeEmployeeAction(log)}</p>
                        <p className="text-[11px] text-slate-400">{summarizeLog(log)}</p>
                    </div>
                )
            },
        },
        {
            accessorKey: "table_name",
            header: "Resource",
            cell: (info) => {
                const log = info.row.original
                return (
                    <div>
                        <p className="text-slate-700">{getModuleLabel(log.table_name)}</p>
                        {log.record_id ? <p className="text-[11px] text-slate-400">#{log.record_id}</p> : null}
                    </div>
                )
            },
        },
        {
            accessorKey: "severity",
            header: "Severity",
            cell: (info) => <SeverityBadge severity={info.row.original.severity} />,
        },
    ]

    if (error) {
        return <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load activity history")}</p>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Activity Log</h1>
                <p className="text-slate-500 text-xs">
                    A history of actions taken on your own account and records.
                    {!loading && <span className="ml-1 text-slate-400">· {logs?.length ?? 0} activities</span>}
                </p>
            </div>

            <FilterToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search activities..."
                statusValue={severityValue}
                onStatusChange={setSeverityValue}
                statusOptions={SEVERITY_OPTIONS}
                onClearFilters={handleClearFilters}
            >
                {actionOptions.length > 0 && (
                    <select
                        value={actionValue}
                        onChange={(e) => setActionValue(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Actions</option>
                        {actionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                )}
                <select
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All time</option>
                    {DATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </FilterToolbar>

            <DataTable
                columns={columns}
                data={paginatedLogs}
                isLoading={loading}
                emptyMessage={
                    logs?.length ? "No activity matches these filters." : "No activity recorded yet."
                }
                onRowClick={setSelectedLog}
                pagination={{
                    currentPage: effectivePage,
                    totalPages,
                    totalItems: filteredLogs.length,
                    pageSize,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: (size) => { setPageSize(size); setCurrentPage(1) },
                }}
            />

            <SideDrawer
                isOpen={Boolean(selectedLog)}
                onClose={() => setSelectedLog(null)}
                title="Activity Details"
                subtitle={selectedLog ? describeEmployeeAction(selectedLog) : undefined}
                size="lg"
            >
                {selectedLog && (
                    <AuditDiffViewer
                        oldValues={selectedLog.old_values}
                        newValues={selectedLog.new_values}
                        action={selectedLog.action}
                        timestamp={selectedLog.created_at}
                        user={user}
                        severity={selectedLog.severity}
                        ipAddress={selectedLog.ip_address}
                        summary={summarizeLog(selectedLog)}
                        theme="light"
                    />
                )}
            </SideDrawer>
        </div>
    )
}
