import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": join(import.meta.dirname, "src") },
  },
  server: {
    // npm run dev:server starts the API on this port.
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
