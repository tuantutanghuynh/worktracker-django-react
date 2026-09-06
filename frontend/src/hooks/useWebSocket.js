import useReactWebSocket, { useWebSocket as useNamedWebSocket } from 'react-use-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useAuthStore } from '../stores/authStore';

/**
 * Custom Hook: Real-time WebSocket connection to Django Channels ws/notifications/
 * Handles live toast notifications and automatic React Query cache invalidation.
 */
export function useWebSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tự động nhận diện hàm hook chuẩn từ thư viện react-use-websocket
  const wsHook = typeof useReactWebSocket === 'function' ? useReactWebSocket : useNamedWebSocket;

  const token = useAuthStore.getState().accessToken;
  const envWs = import.meta.env.VITE_WS_URL;
  const rawApi = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  let wsBase = '';
  if (envWs) {
    wsBase = envWs.replace(/\/$/, '');
  } else if (rawApi) {
    const cleanHost = rawApi.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
    const wsProto = rawApi.startsWith('https') || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${wsProto}//${cleanHost}`;
  } else {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${wsProto}//${window.location.host}`;
  }

  const socketUrl = user && token && typeof wsHook === 'function' 
    ? `${wsBase}/ws/notifications/?token=${token}` 
    : null;

  const { lastJsonMessage, readyState } = (typeof wsHook === 'function' ? wsHook : () => ({}))(socketUrl, {
    shouldReconnect: () => Boolean(user && token),
    reconnectInterval: 3000,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && (data.title || data.message)) {
          if (data.type === 'connected') {
            console.log('[WebSocket Connected]:', data.message);
          } else {
            // 1. Toast Notification nổi góc dưới bên phải
            toast.info(data.title || 'Real-time System Update', {
              description: data.message,
            });

            // 2. Tự động đồng bộ lại dữ liệu mới nhất với React Query
            queryClient.invalidateQueries({ queryKey: ['manager-notifications'] });
            queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['manager-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['manager-timesheets'] });
            queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
          }
        }
      } catch (e) {
        // Ignored non-JSON messages
      }
    },
  });

  return { lastJsonMessage, readyState };
}

export default useWebSocket;
