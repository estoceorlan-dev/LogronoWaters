import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Neon pulls NEON_AUTH_BASE_URL; expose only this public URL to the browser.
  // An explicit VITE_NEON_AUTH_URL still takes precedence for existing deployments.
  const env = loadEnv(mode, process.cwd(), "");
  const authUrl = env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || "";
  return {
    define: { "import.meta.env.VITE_NEON_AUTH_URL": JSON.stringify(authUrl) },
    plugins: [react()],
    server: { proxy: { "/api": "http://127.0.0.1:3001" } },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-")
            )
              return "charts";
            if (
              id.includes("node_modules/@neon/auth") ||
              id.includes("node_modules/better-auth")
            )
              return "auth";
          },
        },
      },
    },
  };
});
