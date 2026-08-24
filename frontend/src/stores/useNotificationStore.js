import { create } from 'zustand';
import { listNotifications, markNotificationRead } from '../api/notifications';

const SEEN_ALERTS_KEY = 'dq_alerts_seen';

// Data-quality alerts (Department without manager, etc.) are computed live
// from DB state, not persisted rows — they have no is_read column to flip.
// "Seen" here just means "the viewer opened the bell/notifications page
// while this exact alert id was showing", tracked per-browser via
// localStorage so the badge count actually clears like a real notification
// would, without needing a backend table for it. A brand new alert id
// (issue reappears, or a different record) is unseen again automatically.
function loadSeenAlertIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_ALERTS_KEY)) || [];
  } catch {
    return [];
  }
}

// fetch/markAsRead go through /api/notifications/ (system.employee.urls_employee)
// — that route is shared by every authenticated role, not Manager-only, so it's
// safe to use here. There is no bulk "mark all read" endpoint on that shared
// route (only Manager's separate viewset has one), so markAllAsRead below just
// fires markNotificationRead for each currently-unread item.
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  wsConnected: false,
  loading: false,
  socket: null,
  error: null,
  seenAlertIds: loadSeenAlertIds(),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  /**
   * Marks the given data-quality alert ids as seen (badge no longer counts
   * them) — called when the bell dropdown opens or the Notifications page
   * loads, for whichever alerts are currently visible.
   */
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
   * Fetch the caller's own notifications from the API.
   */
  fetchNotifications: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const list = await listNotifications(params);
      const unread = list.filter((n) => !n.is_read).length;
      set({ notifications: list, unreadCount: unread, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message || 'Failed to fetch notifications' });
    }
  },

  /**
   * Mark a single notification as read.
   */
  markAsRead: async (id) => {
    try {
      await markNotificationRead(id);
      set((state) => {
        const updated = state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        const unread = updated.filter((n) => !n.is_read).length;
        return { notifications: updated, unreadCount: unread };
      });
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  },

  /**
   * Mark every currently-unread notification as read (no bulk endpoint
   * on the shared route, so this fires one request per unread item).
   */
  markAllAsRead: async () => {
    const unreadIds = get().notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(unreadIds.map((id) => markNotificationRead(id)));
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
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

    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
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
