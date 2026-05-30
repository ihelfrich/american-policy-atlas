import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Local dev/preview serves at root; CI (deploy.yml) sets ATLAS_BASE=/ca-policy-atlas/ for Pages.
export default defineConfig({
  base: process.env.ATLAS_BASE ?? "/",
  plugins: [tailwindcss()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy vendor libs so the main bundle (app logic) stays
        // small and parses fast; MapLibre + the Plot/D3 stack are the bulk.
        manualChunks: {
          maplibre: ["maplibre-gl"],
          dataviz: ["@observablehq/plot", "d3"],
        },
      },
    },
  },
});
