import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cấu hình Vite tích hợp Tailwind CSS v4 & React Plugin + Proxy chuyển tiếp media/api
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tích hợp plugin biên dịch Tailwind v4
  ],
  server: {
    port: 5173,
    proxy: {
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});