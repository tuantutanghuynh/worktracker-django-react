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
  Filter,
  Check
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { formatDistanceToNow } from 'date-fns';

/**
 * NotificationListTable - System Notifications Table / List Component
 * Chuẩn giao diện hiện đại, trực quan, hỗ trợ đánh dấu đã đọc 1-click & hàng loạt
 * 
 * Props:
 * - notifications (Array): List of notification objects
 * - onMarkAsRead (function): (id | id[]) => void
 * - onMarkAllRead (function): () => void
 * - onDelete (function): (id) => void
 * - onNotificationClick (function): (notification) => void
 * - isLoading (boolean): loading state
 */
export default function NotificationListTable({
  notifications = [],
  onMarkAsRead,
  onMarkRead,
  onMarkAllRead,
  onMarkAllAsRead,
  onDelete,
  onNotificationClick,
  onNavigate,
  isLoading = false,
  className
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'TASKS' | 'TIMESHEET'
  const [selectedIds, setSelectedIds] = useState([]);

  // Chuẩn hóa hàm callbacks
  const handleMarkReadFn = onMarkAsRead || onMarkRead;
  const handleMarkAllReadFn = onMarkAllRead || onMarkAllAsRead;
  const handleItemClickFn = (item) => {
    if (handleMarkReadFn && !item.is_read) {
      handleMarkReadFn(item.id);
    }
    if (onNotificationClick) {
      onNotificationClick(item);
    } else if (onNavigate && item.related_url) {
      onNavigate(item.related_url);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(notifications.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
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
        return { label: 'Task Assigned', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'TASK_STATUS_CHANGED':
        return { label: 'Status Changed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'TASK_SUBMITTED':
        return { label: 'Task Submitted', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'TASK_APPROVED':
        return { label: 'Task Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'TASK_REJECTED':
        return { label: 'Task Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'TASK_COMMENT':
        return { label: 'Task Comment', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'TIMESHEET_LOCK':
        return { label: 'Timesheet Lock', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'TIMESHEET_UNLOCK':
        return { label: 'Timesheet Unlock', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'LOG_WORK_APPROVED':
        return { label: 'Log Work Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'LOG_WORK_REJECTED':
        return { label: 'Log Work Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'System Alert', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className={cn("bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 text-slate-900 shadow-2xs", className)}>
      {/* 🌟 Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs">
              <Bell className="w-4 h-4" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Notifications Feed
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                  {unreadCount} unread
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">Manage your real-time alerts and system logs</p>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(selectedIds);
                setSelectedIds([]);
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          {selectedIds.length > 0 && handleMarkReadFn && (
            <button
              type="button"
              onClick={() => {
                handleMarkReadFn(selectedIds);
                setSelectedIds([]);
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark as Read ({selectedIds.length})</span>
            </button>
          )}

          {unreadCount > 0 && handleMarkAllReadFn && (
            <button
              type="button"
              onClick={() => {
                handleMarkAllReadFn();
                setSelectedIds([]);
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* 🔍 Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto">
        {[
          { key: 'ALL', label: `All (${notifications.length})` },
          { key: 'UNREAD', label: `Unread (${unreadCount})` },
          { key: 'TASKS', label: 'Tasks' },
          { key: 'TIMESHEET', label: 'Timesheets' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer",
              activeTab === tab.key
                ? "bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-2xs"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 📋 Notifications Table List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
          No matching notifications in this view.
        </div>
      ) : (
        <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100">
          {filteredNotifications.map((item) => {
            const badge = getEventBadge(item.event_type);
            const isSelected = selectedIds.includes(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleItemClickFn(item)}
                className={cn(
                  "p-4 transition-all flex items-start gap-3.5 group cursor-pointer",
                  !item.is_read ? "bg-blue-50/30 hover:bg-blue-50/60" : "bg-white hover:bg-slate-50/80",
                  isSelected && "bg-blue-50/80"
                )}
              >
                {/* Select Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleSelectRow(e, item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />

                {/* Read Indicator Dot */}
                <div className="mt-1 shrink-0">
                  {!item.is_read ? (
                    <Circle className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                  ) : (
                    <Circle className="w-2.5 h-2.5 text-slate-300" />
                  )}
                </div>

                {/* Main Notification Content */}
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded-full border", badge.bg)}>
                      {badge.label}
                    </span>
                    <h4 className={cn(
                      "text-xs font-bold tracking-tight truncate max-w-lg",
                      !item.is_read ? "text-slate-900" : "text-slate-600"
                    )}>
                      {item.title}
                    </h4>
                  </div>

                  {item.content && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {item.content}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.created_at
                        ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                        : 'Just now'}
                    </span>
                    {item.related_url && (
                      <span className="text-blue-600 font-semibold hover:underline flex items-center gap-1 text-[11px]">
                        <ExternalLink className="w-3 h-3" /> View Details
                      </span>
                    )}
                  </div>
                </div>

                {/* Row Quick Action Menu (1-Click Mark as Read) */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!item.is_read && handleMarkReadFn && (
                    <button
                      type="button"
                      onClick={() => handleMarkReadFn(item.id)}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Read</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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
