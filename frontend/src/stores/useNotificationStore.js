import { create } from 'zustand';
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
      console.error('Failed to mark notification read', err);
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
      console.error('Failed to mark all notifications read', err);
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
  },

  /**
   * Helper to initiate WebSocket connection to ws/notifications/
   */
  connectWebSocket: (wsUrlOverride) => {
    const existingSocket = get().socket;
    if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = useAuthStore.getState().accessToken;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = wsUrlOverride || `${wsProtocol}//${host}/ws/notifications/?token=${token || ''}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        set({ wsConnected: true, socket: ws });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.notification) {
            get().addRealtimeNotification(data.notification);
          } else if (data && data.id) {
            get().addRealtimeNotification(data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket notification message', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        set({ wsConnected: false });
      };

      ws.onclose = () => {
        set({ wsConnected: false, socket: null });
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket connection:', err);
    }
  },

  /**
   * Disconnect active WebSocket
   */
  disconnectWebSocket: () => {
    const ws = get().socket;
    if (ws) {
      ws.close();
      set({ wsConnected: false, socket: null });
    }
  },
}));

export default useNotificationStore;
