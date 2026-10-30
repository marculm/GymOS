import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Integration files share one database; serial runs avoid cross-file
    // serialization conflicts that would never happen in real single-user use.
    fileParallelism: false,
  },
});
