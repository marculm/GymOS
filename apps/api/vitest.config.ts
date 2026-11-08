import { defineConfig } from "vitest/config";
import { generateVAPIDKeys } from "web-push";

const vapidKeys = generateVAPIDKeys();

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Integration files share one database; serial runs keep cross-file
    // write conflicts from making the suite flaky.
    fileParallelism: false,
    env: {
      // Generated per run so no VAPID key material is committed.
      VAPID_PUBLIC_KEY: vapidKeys.publicKey,
      VAPID_PRIVATE_KEY: vapidKeys.privateKey,
      VAPID_SUBJECT: "mailto:test@gymos.app",
    },
  },
});
