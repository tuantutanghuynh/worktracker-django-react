/**
 * Module: utils/wsUrl
 * Description: Dynamically resolves the WebSocket Base URL for realtime notifications and chat.
 * Seamlessly adapts between Localhost development and Cloud Vercel -> Render production.
 */
export function getWebSocketBaseUrl() {
  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs) {
    return envWs.replace(/\/$/, '');
  }

  const rawApi = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (rawApi) {
    const cleanHost = rawApi.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
    const wsProto = rawApi.startsWith('https') || (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    return `${wsProto}//${cleanHost}`;
  }

  // Automatic cloud fallback: If running on Vercel domain, point directly to Render backend
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
    return 'wss://worktracker-api-ccvj.onrender.com';
  }

  const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
  return `${wsProto}//${host}`;
}

