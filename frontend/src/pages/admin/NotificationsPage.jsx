import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, CheckCheck, AlertTriangle } from 'lucide-react';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { useAdminDataQualityAlerts } from '../../hooks/queries/admin/useAdminNotifications';

const EVENT_TYPE_LABELS = {
  TASK_ASSIGNED: 'Task Assigned',
  TASK_STATUS_CHANGED: 'Task Status Changed',
  TASK_COMMENT: 'Task Comment',
  TASK_SUBMITTED: 'Task Submitted',
  TASK_APPROVED: 'Task Approved',
  TASK_REJECTED: 'Task Rejected',
  TASK_ATTACHMENT: 'Task Attachment',
  TIMESHEET_LOCK: 'Timesheet Lock',
  TIMESHEET_UNLOCK: 'Timesheet Unlock',
  REPORT_EXPORTED: 'Report Exported',
  ACCOUNT_OR_PERMISSION_CHANGED: 'Account / Permission Changed',
};

// Full notification inbox for the Admin role — reuses the same
// useNotificationStore already fed by AdminLayout's fetchNotifications(),
// so this page just renders the store's state instead of refetching.
export function NotificationsPage() {
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, seenAlertIds, markAlertsSeen } =
    useNotificationStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synthetic, not-persisted alerts (Department without manager, Employee
  // without department, Client missing contact info) — computed live from
  // current DB state, so no read/unread tracking for these.
  const { data: dataQualityAlerts = [] } = useAdminDataQualityAlerts();

  // Visiting this page counts as "read" for whichever alerts are showing
  // right now, same as opening the bell dropdown (Header.jsx).
  useEffect(() => {
    if (dataQualityAlerts.length > 0) {
      markAlertsSeen(dataQualityAlerts.map((a) => a.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataQualityAlerts]);

  const unseenDataQualityCount = dataQualityAlerts.filter((a) => !seenAlertIds.includes(a.id)).length;

  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Notifications</h1>
        {(unreadCount > 0 || unseenDataQualityCount > 0) && (
          <button
            type="button"
            onClick={() => {
              markAllAsRead();
              markAlertsSeen(dataQualityAlerts.map((a) => a.id));
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {['all', 'unread'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {key === 'all' ? 'All' : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {loading && <div className="p-8 text-center text-sm text-slate-400">Loading...</div>}

        {!loading && visible.length === 0 && (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
            </p>
          </div>
        )}

        {!loading &&
          visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${
                n.is_read ? '' : 'bg-blue-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{n.title}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {EVENT_TYPE_LABELS[n.event_type] || n.event_type}
                    </span>
                  </div>
                  {n.content && <p className="text-xs text-slate-500 mt-1">{n.content}</p>}
                </div>
                {!n.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {format(new Date(n.created_at), 'HH:mm - yyyy-MM-dd')}
              </p>
            </button>
          ))}
      </div>

      {dataQualityAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900">Data Quality</h2>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {dataQualityAlerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.related_url}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-amber-50/40 transition-colors"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{alert.content}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
