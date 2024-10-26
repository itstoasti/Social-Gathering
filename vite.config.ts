import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        app: './index.html'
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react'],
          utils: ['axios']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
