import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://social-gathering.onrender.com',
        changeOrigin: true,
        secure: false,
        withCredentials: true
      }
    }
  }
});
