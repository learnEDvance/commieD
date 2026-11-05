import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const serverUrl = env.SERVER_URL ?? 'http://localhost:8080';

  return {
    server: {
      host: true,
      port: Number(env.CLIENT_PORT ?? 5173),
      proxy: {
        '/ws': { target: serverUrl, ws: true },
        '/api': { target: serverUrl, changeOrigin: true },
        '/health': { target: serverUrl, changeOrigin: true },
      },
    },
  };
});
