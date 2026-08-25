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
    deleteNotification,
    connectWebSocket,
  } = useNotificationStore();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'

  useEffect(() => {
    // Initial fetch from backend API
    fetchNotifications().catch((err) => {
      console.warn('Notification fetch fallback:', err);
    });

    // Initiate real-time WebSocket connection
    connectWebSocket();
  }, [fetchNotifications, connectWebSocket]);

  const displayNotifications = notifications || [];

  // Lọc thông báo
  const filteredNotifications = displayNotifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.is_read;
    if (activeFilter === 'READ') return n.is_read;
    return true;
  });

  const handleMarkAsRead = async (idOrIds) => {
    try {
      if (Array.isArray(idOrIds)) {
        for (const id of idOrIds) {
          await markAsRead(id);
        }
        toast.success(`Marked ${idOrIds.length} notification${idOrIds.length > 1 ? 's' : ''} as read.`);
      } else {
        await markAsRead(idOrIds);
        toast.success('Notification marked as read.');
      }
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      toast.success('All notifications marked as read.');
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  const handleDelete = async (idOrIds) => {
    try {
      await deleteNotification(idOrIds);
      const count = Array.isArray(idOrIds) ? idOrIds.length : 1;
      toast.success(`Deleted ${count} notification${count > 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Delete notification failed:', err);
      toast.error('Failed to delete notification.');
    }
  };

  const handleNavigate = (url) => {
    if (url) {
      navigate(url);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 pb-12 antialiased">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
              <Bell className="w-6 h-6" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">System Notifications & Alerts</h1>
              {wsConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Wifi className="w-3 h-3 text-emerald-500" /> Live WebSocket
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  <WifiOff className="w-3 h-3" /> Polling Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time audit alerts, task approvals, workflow assignments, and timesheet lock notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 text-xs shadow-2xs transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All as Read</span>
            </button>
          )}

          <button
            onClick={() => fetchNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 🔍 FILTER TABS */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            All ({displayNotifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('UNREAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeFilter === 'UNREAD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setActiveFilter('READ')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeFilter === 'READ'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Read ({Math.max(0, displayNotifications.length - unreadCount)})
          </button>
        </div>
      </div>

      {/* 📋 NOTIFICATIONS TABLE OR EMPTY STATE */}
      <div>
        {filteredNotifications.length > 0 ? (
          <NotificationListTable
            notifications={filteredNotifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllRead={handleMarkAllRead}
            onDelete={handleDelete}
            onNavigate={handleNavigate}
            isLoading={loading}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6 stroke-1" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No notifications found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You are all caught up! When new tasks are assigned, reviewed, or locked, real-time alerts will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
