import React, { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Circle, 
  Mail, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  User,
  Filter
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { formatDistanceToNow } from 'date-fns';

/**
 * NotificationListTable - System Notifications Table / List Component
 * 
 * Props:
 * - notifications (Array): List of notification objects
 *     [{ id, event_type, type, title, content, is_read, created_at, related_url }]
 * - onMarkAsRead (function): (id | id[]) => void
 * - onMarkAllRead (function): () => void
 * - onDelete (function): (id) => void
 * - onNotificationClick (function): (notification) => void
 * - isLoading (boolean): loading state
 */
export default function NotificationListTable({
  notifications = [],
  onMarkAsRead,
  onMarkAllRead,
  onDelete,
  onNotificationClick,
  isLoading = false,
  className
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'TASKS' | 'TIMESHEET'
  const [selectedIds, setSelectedIds] = useState([]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(notifications.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredNotifications = notifications.filter(item => {
    if (activeTab === 'UNREAD') return !item.is_read;
    if (activeTab === 'TASKS') return item.event_type?.startsWith('TASK_');
    if (activeTab === 'TIMESHEET') return item.event_type?.startsWith('TIMESHEET_');
    return true;
  });

  const getEventBadge = (eventType) => {
    switch (eventType) {
      case 'TASK_ASSIGNED':
        return { label: 'Task Assigned', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'TASK_STATUS_CHANGED':
        return { label: 'Status Changed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'TASK_REJECTED':
        return { label: 'Task Rejected', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'TIMESHEET_LOCK':
        return { label: 'Timesheet Lock', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'TIMESHEET_UNLOCK':
        return { label: 'Timesheet Unlock', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default:
        return { label: 'System', bg: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-100", className)}>
      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-indigo-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Notifications Center
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
                  {unreadCount} unread
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onMarkAsRead && onMarkAsRead(selectedIds)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark as Read ({selectedIds.length})
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => onMarkAllRead && onMarkAllRead()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'UNREAD', label: `Unread (${unreadCount})` },
          { key: 'TASKS', label: 'Tasks' },
          { key: 'TIMESHEET', label: 'Timesheets' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer",
              activeTab === tab.key
                ? "bg-slate-800 text-blue-400 border border-slate-700 font-bold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications Table List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
          No matching notifications found.
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 divide-y divide-slate-800/70">
          {filteredNotifications.map((item) => {
            const badge = getEventBadge(item.event_type);
            const isSelected = selectedIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  "p-4 transition-colors flex items-start gap-3.5 group",
                  !item.is_read ? "bg-slate-900/90 font-medium" : "bg-slate-950/30 opacity-75 hover:opacity-100",
                  isSelected && "bg-indigo-950/20"
                )}
              >
                {/* Select Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectRow(item.id)}
                  className="mt-1 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />

                {/* Read Indicator Dot */}
                <div className="mt-1">
                  {!item.is_read ? (
                    <Circle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />
                  ) : (
                    <Circle className="w-2.5 h-2.5 text-slate-700" />
                  )}
                </div>

                {/* Main Notification Content */}
                <div 
                  className="flex-1 space-y-1 cursor-pointer"
                  onClick={() => onNotificationClick && onNotificationClick(item)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border", badge.bg)}>
                      {badge.label}
                    </span>
                    <h4 className={cn(
                      "text-xs font-bold tracking-tight",
                      !item.is_read ? "text-slate-100" : "text-slate-300"
                    )}>
                      {item.title}
                    </h4>
                  </div>

                  {item.content && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {item.content}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.created_at
                        ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                        : 'Just now'}
                    </span>
                    {item.related_url && (
                      <span className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[10px]">
                        <ExternalLink className="w-3 h-3" /> Details
                      </span>
                    )}
                  </div>
                </div>

                {/* Row Quick Action Menu */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  {!item.is_read && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead && onMarkAsRead(item.id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
