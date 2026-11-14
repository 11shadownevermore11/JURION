import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_API_PROXY_TARGET || "http://localhost:8000";
  return {
    plugins: [react()],
    // Относительные пути: сборку можно раздавать из любого подкаталога.
    base: "./",
    server: {
      port: 5173,
      host: true,
      proxy: { "/api": { target, changeOrigin: true } },
    },
    preview: { port: 4173, host: true },
  };
});
