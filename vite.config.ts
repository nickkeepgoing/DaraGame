import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // แยก phaser ออกเป็น chunk ของตัวเอง -> เบราว์เซอร์ cache ไว้ได้
    // และ UI โหลดขึ้นจอก่อนที่ engine จะโหลดเสร็จ
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['react', 'react-dom', 'zustand', '@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1600, // phaser ตัวเดียวก็ ~1.2MB อยู่แล้ว
  },
  server: { host: true, port: 5173 },
});
