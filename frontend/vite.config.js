import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cấu hình Vite tích hợp Tailwind CSS v4 & React Plugin
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tích hợp plugin biên dịch Tailwind v4
  ],
});
