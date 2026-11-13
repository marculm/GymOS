import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import { pwaManifest } from "./src/pwa-manifest.mts";

export default defineConfig({
  resolve: {
    conditions: ["browser"],
  },
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      // The plugin only compiles service-worker sources named with a .ts extension.
      filename: "sw.ts",
      manifest: pwaManifest,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.mts"],
  },
});
