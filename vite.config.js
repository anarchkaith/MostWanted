import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || '8787';
  const backendTarget = env.VITE_BACKEND_TARGET || `http://localhost:${backendPort}`;
  const frontendPort = Number(env.VITE_DEV_PORT || 5180);

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api/ia-chat': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 300000,
          proxyTimeout: 300000,
        },
        '/api/ia-intent': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/api/ia-report-correlation': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
        },
        '/api/reports': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 30000,
          proxyTimeout: 30000,
        },
        '/api/battleye-status': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 30000,
          proxyTimeout: 30000,
        },
        '/api': {
          target: 'http://localhost:8888',
          changeOrigin: true,
        }
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
    root: './',
    publicDir: 'public',
    build: {
      outDir: 'dist',
    },
  };
});
