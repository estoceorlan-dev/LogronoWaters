import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
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
});
