import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read VITE_DEV_API from client/.env* as well as the shell
  const API = loadEnv(mode, process.cwd(), '').VITE_DEV_API || 'http://localhost:5050';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: API, changeOrigin: true },
        '/uploads': { target: API, changeOrigin: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            tfjs: ['@tensorflow/tfjs'],
            mediapipe: ['@mediapipe/tasks-vision'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
