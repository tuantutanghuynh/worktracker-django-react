import { create } from 'zustand';
import { toast } from 'sonner';
import managerReportService from '../services/manager/managerReportService';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notificationApi';
import { useAuthStore } from './authStore';

// Picks the right backend depending on role — Manager's notification
// routes live under /manager/system/notifications/ and are role-gated;
// calling them as an Employee/Admin would 403.
function isManager() {
  const role = (useAuthStore.getState().user?.role || '').toUpperCase();
  return role === 'MANAGER';
}

const SEEN_ALERTS_KEY = 'dq_alerts_seen';

// Data-quality alerts (Admin's "Department without manager" etc.) are
// computed live from DB state, not persisted rows — no is_read column to
// flip. "Seen" just means "the viewer opened the bell/notifications page
// while this exact alert id was showing", tracked per-browser via
// localStorage. Ported from Minh Anh's useNotificationStore.js (her
// version got dropped when this file's merge conflict was resolved) —
// AdminNotificationsPage needs it, none of Employee/Manager's flow uses it.
function loadSeenAlertIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_ALERTS_KEY)) || [];
  } catch {
    return [];
  }
}

let reconnectAttempts = 0;
let reconnectTimer = null;
let pingInterval = null;
let lifecycleAttached = false;

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  wsConnected: false,
  loading: false,
  socket: null,
  error: null,
  seenAlertIds: loadSeenAlertIds(),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  markAlertsSeen: (ids) => {
    if (!ids || ids.length === 0) return;
    set((state) => {
      const merged = Array.from(new Set([...state.seenAlertIds, ...ids]));
      try {
        localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(merged));
      } catch {
        // localStorage unavailable (private window, blocked site data) —
        // badge just won't persist across reloads, not worth surfacing.
      }
      return { seenAlertIds: merged };
    });
  },

  /**
   * Fetch initial notifications from API
   */
  fetchNotifications: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const data = isManager()
        ? await managerReportService.getNotifications(params)
        : await getNotifications();
      const list = Array.isArray(data) ? data : data.results || [];
      const unread = list.filter((n) => !n.is_read).length;
      set({ notifications: list, unreadCount: unread, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message || 'Failed to fetch notifications' });
    }
  },

  /**
   * Mark single notification as read
   */
  markAsRead: async (id) => {
    try {
      if (isManager()) {
        await managerReportService.markNotificationRead(id);
      } else {
        await markNotificationRead(id);
      }
      set((state) => {
        const updated = state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        const unread = updated.filter((n) => !n.is_read).length;
        return { notifications: updated, unreadCount: unread };
      });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    try {
      if (isManager()) {
        await managerReportService.markAllNotificationsRead();
      } else {
        await markAllNotificationsRead();
      }
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  },

  /**
   * Delete single or multiple notifications (Optimistic Update)
   */
  deleteNotification: async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;

    // Cập nhật State tức thì (Optimistic UI)
    set((state) => {
      const updated = state.notifications.filter((n) => !ids.includes(n.id));
      const unread = updated.filter((n) => !n.is_read).length;
      return { notifications: updated, unreadCount: unread };
    });

    try {
      if (isManager()) {
        await managerReportService.deleteNotificationsBatch(ids);
      }
    } catch (err) {
      console.error('Failed to delete notifications on server', err);
    }
  },

  /**
   * Handle incoming real-time WS notification object
   */
  addRealtimeNotification: (notification) => {
    if (!notification) return;
    set((state) => {
      // Prevent duplicate notifications by ID
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) return state;
      const updated = [notification, ...state.notifications];
      const unread = notification.is_read ? state.unreadCount : state.unreadCount + 1;
      return { notifications: updated, unreadCount: unread };
    });

    // Bắn Toast thông báo nổi tức thì góc màn hình
    if (notification.title) {
      toast.info(notification.title, {
        description: notification.content || undefined,
        duration: 5000,
      });
    }
  },

  /**
   * Helper to initiate WebSocket connection to ws/notifications/ with Enterprise Resilience
   */
  connectWebSocket: (wsUrlOverride) => {
    const existingSocket = get().socket;
    if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = wsUrlOverride || `${wsProtocol}//${host}/ws/notifications/?token=${token}`;

    // Tự động lắng nghe sự kiện Tab Focus / Visibility để bù đắp dữ liệu khi user quay lại tab
    if (!lifecycleAttached && typeof window !== 'undefined') {
      lifecycleAttached = true;
      const handleSync = () => {
        if (document.visibilityState === 'visible' && useAuthStore.getState().accessToken) {
          get().fetchNotifications();
          const currentWs = get().socket;
          if (!currentWs || currentWs.readyState === WebSocket.CLOSED || currentWs.readyState === WebSocket.CLOSING) {
            get().connectWebSocket();
          }
        }
      };
      document.addEventListener('visibilitychange', handleSync);
      window.addEventListener('focus', handleSync);
    }

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        set({ wsConnected: true, socket: ws });
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Gap-Healing: Tự động tải lại thông báo ngay khi vừa kết nối để không lỡ tin trong lúc mất mạng
        get().fetchNotifications();

        // Heartbeat KeepAlive: Định kỳ 25s gửi ping nhẹ để duy trì socket qua các router/proxy
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (e) {
              // Ignore send error on closing socket
            }
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'pong') return;

          // Backend NotificationConsumer sends: { type: "notification", data: payload }
          const notif = data?.data || data?.notification || (data?.id ? data : null);
          if (notif && notif.id) {
            get().addRealtimeNotification(notif);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket notification message', e);
        }
      };

      ws.onerror = () => {
        set({ wsConnected: false });
      };

      ws.onclose = () => {
        set({ wsConnected: false, socket: null });
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        // Exponential Backoff with Jitter for Reconnection (1s -> 2s -> 4s -> max 30s)
        if (useAuthStore.getState().accessToken) {
          const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts)) + Math.random() * 1000;
          reconnectAttempts += 1;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            get().connectWebSocket();
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket connection:', err);
    }
  },

  /**
   * Disconnect active WebSocket
   */
  disconnectWebSocket: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    const ws = get().socket;
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        // Ignore close error
      }
      set({ wsConnected: false, socket: null });
    }
  },
}));

export default useNotificationStore;
