import { useEffect } from "react"
import { useNotificationStore } from "../../stores/useNotificationStore"
import NotificationListTable from "../../components/common/feeds/NotificationListTable"

// Employee Notifications page (Ngày 9, phần 2) — thin wrapper around the
// shared notification store (fixed earlier to call the right backend per
// role) and Long's NotificationListTable component.
export function NotificationsPage() {
    const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore()

    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    // NotificationListTable calls onMarkAsRead with either a single id
    // (row action) or an array of ids (bulk "Mark as Read (n)" button) —
    // normalize both into individual markAsRead() calls.
    function handleMarkAsRead(idOrIds) {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        ids.forEach((id) => markAsRead(id))
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notifications</h1>
                <p className="text-slate-500 text-xs">Stay updated on task assignments, approvals, and timesheet events.</p>
            </div>

            <NotificationListTable
                notifications={notifications}
                isLoading={loading}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllRead={markAllAsRead}
            />
        </div>
    )
}
