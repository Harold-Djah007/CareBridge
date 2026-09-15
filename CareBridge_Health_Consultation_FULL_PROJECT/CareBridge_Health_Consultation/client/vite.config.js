import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = {
  "/api": "http://127.0.0.1:5000",
  "/socket.io": { target: "http://127.0.0.1:5000", ws: true },
};

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/lucide-react/")) return "icons";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy,
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy,
  },
});
