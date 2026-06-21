import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite config tuned for Tauri: fixed port, no auto-open, env passthrough.
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
  },
}));
