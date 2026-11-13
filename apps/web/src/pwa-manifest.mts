import type { ManifestOptions } from "vite-plugin-pwa";

export const pwaManifest: Partial<ManifestOptions> = {
  name: "GymOS",
  short_name: "GymOS",
  description: "Your all-in-one gym and nutrition operating system",
  theme_color: "#000000",
  background_color: "#000000",
  display: "standalone",
  start_url: "/gym",
  scope: "/",
  icons: [
    {
      src: "/pwa-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/pwa-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/pwa-maskable-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
