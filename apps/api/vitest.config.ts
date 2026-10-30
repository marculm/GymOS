import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Integration files share one database; serial runs keep cross-file
    // write conflicts from making the suite flaky.
    fileParallelism: false,
  },
});
