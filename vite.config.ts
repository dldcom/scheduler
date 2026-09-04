import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["moon-observatory.dldcom.xyz"],
    headers: {
      "Cache-Control": "no-store",
    },
  },
  test: {
    environment: "node",
  },
});
