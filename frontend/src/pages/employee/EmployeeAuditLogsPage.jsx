import { useState, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { useAuditLog } from "../../hooks/queries/employee/useAuditLog"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import SeverityBadge from "../../components/common/badges/SeverityBadge"
import { getErrorMessage } from "../../utils/errorMessages"

const SEVERITY_OPTIONS = [
    { value: "NORMAL", label: "Normal" },
    { value: "WARNING", label: "Warning" },
    { value: "CRITICAL", label: "Critical" },
]

// Employee's own activity history — audit_logs scoped to user=me only,
// not a system-wide view (that's Admin) or team view (that's Manager).
export function EmployeeAuditLogsPage() {
    const { data: logs, isLoading: loading, error } = useAuditLog()
    const [searchQuery, setSearchQuery] = useState("")
    const [severityValue, setSeverityValue] = useState("")

    const filteredLogs = useMemo(() => {
        return (logs ?? []).filter((log) => {
            if (severityValue && log.severity !== severityValue) return false
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                const matchesSummary = log.summary?.toLowerCase().includes(q)
                const matchesAction = log.action?.toLowerCase().includes(q)
                const matchesTable = log.table_name?.toLowerCase().includes(q)
                if (!matchesSummary && !matchesAction && !matchesTable) return false
            }
            return true
        })
    }, [logs, searchQuery, severityValue])

    function handleClearFilters() {
        setSearchQuery("")
        setSeverityValue("")
    }

    const columns = [
        {
            accessorKey: "created_at",
            header: "Timestamp",
            cell: (info) => format(parseISO(info.row.original.created_at), "d MMM yyyy, HH:mm"),
        },
        { accessorKey: "action", header: "Action" },
        { accessorKey: "table_name", header: "Table" },
        { accessorKey: "record_id", header: "Record ID" },
        { accessorKey: "summary", header: "Summary", cell: (info) => info.row.original.summary || "—" },
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
                <p className="text-slate-500 text-xs">A history of actions taken on your own account and records.</p>
            </div>

            <FilterToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search action, table, summary..."
                statusValue={severityValue}
                onStatusChange={setSeverityValue}
                statusOptions={SEVERITY_OPTIONS}
                onClearFilters={handleClearFilters}
            />

            <DataTable
                columns={columns}
                data={filteredLogs}
                isLoading={loading}
                emptyMessage="No activity recorded yet."
            />
        </div>
    )
}
