import React, { useState, useMemo } from 'react';
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
import { useAuthStore } from '../../../stores/authStore';
import { cn } from '../../../utils/cn';
import { formatDistanceToNow } from 'date-fns';
import PaginationBar from '../table/PaginationBar';

/**
 * Hàm phân giải và chuẩn hóa đường dẫn thông báo thông minh theo Role (Manager & Employee)
 * Tránh trường hợp dẫn vào các route ảo/không tồn tại gây redirect về Dashboard
 */
export function resolveNotificationUrl(url, eventType) {
  const role = (useAuthStore.getState().user?.role || '').toUpperCase();
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isAdmin = role === 'ADMIN';

  // 1. Nếu có URL trực tiếp hợp lệ, ưu tiên chuẩn hóa theo URL
  if (url && typeof url === 'string') {
    const trimmed = url.trim();
    if (trimmed && trimmed !== '#' && trimmed !== '/') {
      if (isManager) {
        if (trimmed.includes('/timesheet') || trimmed.includes('/log-work')) return '/manager/timesheets/review';
        if (trimmed.includes('/tasks')) return '/manager/tasks/review';
        if (trimmed.includes('/jobs')) return '/manager/jobs';
        if (trimmed.startsWith('/manager/')) return trimmed;
      }
      if (isEmployee) {
        if (trimmed.includes('/timesheet') || trimmed.includes('/log-work')) return '/employee/timesheet';
        if (trimmed.includes('/tasks')) return '/employee/my-tasks';
        if (trimmed.startsWith('/employee/')) return trimmed;
      }
      if (isAdmin && trimmed.startsWith('/admin/')) {
        return trimmed;
      }
    }
  }

  // 2. Phân giải dựa trên Event Type nếu không có URL cụ thể
  if (eventType) {
    if (eventType.startsWith('TIMESHEET_') || eventType.startsWith('LOG_WORK_')) {
      if (isManager) return '/manager/timesheets/review';
      if (isEmployee) return '/employee/timesheet';
    }

    if (eventType.startsWith('TASK_')) {
      if (isManager) return '/manager/tasks/review';
      if (isEmployee) return '/employee/my-tasks';
    }

    if (eventType === 'DATA_QUALITY_ALERT' && isAdmin) {
      return url || '/admin/dashboard';
    }
  }

  return null;
}

/**
 * NotificationListTable - System Notifications Table / List Component
 * Chuẩn giao diện hiện đại, trực quan, hỗ trợ đánh dấu đã đọc 1-click & hàng loạt
 * 
 * Props:
 * - notifications (Array): List of notification objects
 * - onMarkAsRead (function): (id | id[]) => void
 * - onMarkAllRead (function): () => void
 * - onDelete (function): (id) => void
 * - onNotificationClick (function): (notification, targetUrl) => void
 * - onNavigate (function): (targetUrl) => void
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Chuẩn hóa hàm callbacks
  const handleMarkReadFn = onMarkAsRead || onMarkRead;
  const handleMarkAllReadFn = onMarkAllRead || onMarkAllAsRead;

  // Bấm vào thân dòng thông báo: CHỈ đánh dấu đã đọc, KHÔNG tự động chuyển trang
  const handleRowClick = (item) => {
    if (handleMarkReadFn && !item.is_read) {
      handleMarkReadFn(item.id);
    }
  };

  // Bấm vào nút "View Details": Đánh dấu đã đọc VÀ chuyển đúng đến trang chi tiết
  const handleViewDetails = (e, item, targetUrl) => {
    e.stopPropagation();
    if (handleMarkReadFn && !item.is_read) {
      handleMarkReadFn(item.id);
    }
    if (onNavigate) {
      onNavigate(targetUrl);
    } else if (onNotificationClick) {
      onNotificationClick(item, targetUrl);
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

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeTab === 'UNREAD') return !item.is_read;
      if (activeTab === 'TASKS') return item.event_type?.startsWith('TASK_');
      if (activeTab === 'TIMESHEET') return item.event_type?.startsWith('TIMESHEET_') || item.event_type?.startsWith('LOG_WORK_');
      return true;
    });
  }, [notifications, activeTab]);

  const totalItems = filteredNotifications.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

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
      case 'LOG_WORK_SUBMITTED':
        return { label: 'Log Work Submitted', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'LOG_WORK_APPROVED':
        return { label: 'Log Work Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'LOG_WORK_REJECTED':
        return { label: 'Log Work Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'LOG_WORK_VOIDED':
        return { label: 'Log Work Voided', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
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

        {/* Toolbar controls: Only show Delete Selected when items are checked */}
        <div className="flex items-center gap-2">
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
            onClick={() => {
              setActiveTab(tab.key);
              setCurrentPage(1);
            }}
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
          {/* Select All Header Bar */}
          {onDelete && (
            <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 font-semibold select-none">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    filteredNotifications.length > 0 &&
                    filteredNotifications.every((n) => selectedIds.includes(n.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredNotifications.map((n) => n.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
                <span>Select All ({filteredNotifications.length})</span>
              </label>
              {selectedIds.length > 0 && (
                <span className="text-[11px] font-bold text-blue-600">
                  {selectedIds.length} selected
                </span>
              )}
            </div>
          )}

          {paginatedNotifications.map((item) => {
            const badge = getEventBadge(item.event_type);
            const isSelected = selectedIds.includes(item.id);
            const targetUrl = resolveNotificationUrl(item.related_url, item.event_type);

            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(item)}
                className={cn(
                  "p-4 transition-all flex items-start gap-3.5 group cursor-pointer",
                  !item.is_read ? "bg-blue-50/30 hover:bg-blue-50/60" : "bg-white hover:bg-slate-50/80",
                  isSelected && "bg-blue-50/80"
                )}
              >
                {/* Select Checkbox (only if onDelete is enabled) */}
                {onDelete && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSelectRow(e, item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                )}

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
                    {targetUrl && (
                      <button
                        type="button"
                        onClick={(e) => handleViewDetails(e, item, targetUrl)}
                        className="text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> View Details
                      </button>
                    )}
                  </div>
                </div>

                {/* Row Quick Action: Only 1-Click Mark as Read */}
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
                </div>
              </div>
            );
          })}

          {totalItems > 0 && (
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
