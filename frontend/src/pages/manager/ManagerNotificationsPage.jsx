import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCheck,
  ShieldCheck,
  Trash2,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import NotificationListTable from '../../components/common/feeds/NotificationListTable';
import { useNotificationStore } from '../../stores/useNotificationStore';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    event_type: 'TASK_ASSIGNED',
    title: 'Công việc mới được giao',
    content: 'Bạn đã được phân công quản lý dự án "Thiết kế UI WorkTracker Pro"',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    related_url: '/manager/kanban',
  },
  {
    id: 2,
    event_type: 'TIMESHEET_LOCK',
    title: 'Khóa kỳ công tháng 07/2026',
    content: 'Kỳ công làm việc tháng 07/2026 của phòng Kỹ Thuật đã chính thức được chốt khóa',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    related_url: '/manager/timelock',
  },
  {
    id: 3,
    event_type: 'TASK_STATUS_CHANGED',
    title: 'Thay đổi trạng thái Task',
    content: 'Nguyễn Văn A đã cập nhật task "Tối ưu hóa Query Database" sang COMPLETED',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    related_url: '/manager/kanban',
  },
  {
    id: 4,
    event_type: 'SYSTEM_ALERT',
    title: 'Cảnh báo tiến độ công việc',
    content: 'Có 3 công việc thuộc dự án Mobile App đã quá hạn chót phê duyệt',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    related_url: '/manager/dashboard',
  },
];

export default function ManagerNotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    wsConnected,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    connectWebSocket,
    disconnectWebSocket
  } = useNotificationStore();

  const [localNotifications, setLocalNotifications] = useState(DEFAULT_NOTIFICATIONS);

  useEffect(() => {
    // Initial fetch from backend API
    fetchNotifications().catch((err) => {
      console.warn('Notification fetch fallback:', err);
    });

    // Initiate real-time WebSocket connection
    connectWebSocket();

    return () => {
      // Clean up WebSocket connection when leaving page if needed
      // disconnectWebSocket();
    };
  }, [fetchNotifications, connectWebSocket]);

  // Combine store notifications or default fallback if store empty
  const displayNotifications = notifications && notifications.length > 0
    ? notifications
    : localNotifications;

  const handleMarkAsRead = async (idOrIds) => {
    if (Array.isArray(idOrIds)) {
      for (const id of idOrIds) {
        await markAsRead(id);
      }
      setLocalNotifications((prev) =>
        prev.map((n) => (idOrIds.includes(n.id) ? { ...n, is_read: true } : n))
      );
      toast.success(`Đã đánh dấu đọc ${idOrIds.length} thông báo`);
    } else {
      await markAsRead(idOrIds);
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === idOrIds ? { ...n, is_read: true } : n))
      );
      toast.success('Đã đánh dấu đọc thông báo');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('Đã đánh dấu đọc tất cả thông báo');
  };

  const handleDelete = (id) => {
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success('Đã xóa thông báo khỏi danh sách');
  };

  const handleNotificationClick = (item) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (item.related_url) {
      navigate(item.related_url);
    }
  };

  const handleReconnectWs = () => {
    connectWebSocket();
    toast.info('Đang kết nối lại WebSockets...');
  };

  const calculatedUnread = displayNotifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              Trung Tâm Thông Báo
            </h1>
            {calculatedUnread > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full">
                {calculatedUnread} chưa đọc
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Thông báo thời gian thực về tiến độ dự án, duyệt giờ làm (Timesheet) và biến động hệ thống
          </p>
        </div>

        {/* WebSocket Status & Quick Tools */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${wsConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
          >
            {wsConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>WS Realtime: Đã kết nối</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>WS Ngoại tuyến</span>
                <button
                  type="button"
                  onClick={handleReconnectWs}
                  className="ml-1 underline hover:text-amber-200"
                >
                  Kết nối lại
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchNotifications()}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Notification Table Feed */}
      <NotificationListTable
        notifications={displayNotifications}
        isLoading={loading}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllRead={handleMarkAllRead}
        onDelete={handleDelete}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
}

