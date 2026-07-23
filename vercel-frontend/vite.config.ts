import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://luma-health-demo.thiago-nunes-5e0.workers.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
