import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const browserTargets = [
  "chrome90",
  "edge90",
  "firefox88",
  "safari14",
  "ios14",
  "es2019",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: browserTargets,
    cssTarget: browserTargets,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (normalizedId.includes("/src/pages/checklists/")) return "pages-checklists";
          if (normalizedId.includes("/src/pages/attendance/")) return "pages-attendance";
          if (normalizedId.includes("/src/pages/complaints/")) return "pages-complaints";
          if (normalizedId.includes("/src/pages/polls/")) return "pages-polls";
          if (normalizedId.includes("/src/pages/masters/")) return "pages-masters";
          if (normalizedId.includes("/src/pages/Dashboard")) return "pages-dashboard";

          if (!normalizedId.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
            return "vendor-react";
          }
          if (id.includes("recharts") || id.includes("chart.js") || id.includes("react-chartjs")) {
            return "vendor-charts";
          }
          if (id.includes("axios") || id.includes("bootstrap")) {
            return "vendor-core";
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: browserTargets,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
