import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: '/WST---Immune-Defense/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        game: path.resolve(import.meta.dirname, 'game/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    open: true,
  },
});
