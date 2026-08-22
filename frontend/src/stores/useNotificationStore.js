import { create } from 'zustand';

// Fetch/markAsRead/markAllAsRead tạm bỏ khỏi file này — bản gốc gọi qua
// services/manager/managerReportService (đã xoá cùng đợt dọn Manager-only
// code). Sẽ nối lại đúng endpoint thật lúc merge với nhánh Long. Phần
// WebSocket/local state dưới đây không phụ thuộc Manager nên giữ nguyên.
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  wsConnected: false,
  loading: false,
  socket: null,
  error: null,

  setWsConnected: (connected) => set({ wsConnected: connected }),

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
