import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiOrigin = `http://127.0.0.1:${process.env.CAREBRIDGE_API_PORT || 5000}`;
const proxy = {
  "/api": apiOrigin,
  "/socket.io": { target: apiOrigin, ws: true },
};

export default defineConfig({
  plugins: [react()],
  build: {
    minify: "terser",
    terserOptions: { compress: { passes: 2 } },
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
