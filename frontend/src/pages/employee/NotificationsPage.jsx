import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCheck, RefreshCw } from "lucide-react"
import { useNotificationStore } from "../../stores/useNotificationStore"
import NotificationListTable from "../../components/common/feeds/NotificationListTable"

// Employee Notifications page (Ngày 9, phần 2) — thin wrapper around the
// shared notification store (fixed earlier to call the right backend per
// role) and Long's NotificationListTable component.
export function NotificationsPage() {
    const navigate = useNavigate()
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotificationStore()

    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    function handleMarkAsRead(idOrIds) {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        ids.forEach((id) => markAsRead(id))
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notifications</h1>
                    <p className="text-slate-500 text-xs mt-0.5">Stay updated on task assignments, approvals, and timesheet events.</p>
                </div>

                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 text-xs shadow-2xs transition cursor-pointer"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark All as Read</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => fetchNotifications()}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <NotificationListTable
                notifications={notifications}
                isLoading={loading}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllRead={markAllAsRead}
                onDelete={deleteNotification}
                onNavigate={(url) => url && navigate(url)}
            />
        </div>
    )
}
