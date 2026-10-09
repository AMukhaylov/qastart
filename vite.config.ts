import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    watch: {
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
