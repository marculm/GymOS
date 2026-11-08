import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Integration files share one database; serial runs keep cross-file
    // write conflicts from making the suite flaky.
    fileParallelism: false,
    env: {
      // Throwaway key pair generated with web-push; tests never reach a push service.
      VAPID_PUBLIC_KEY:
        "BPMKLwfRXt3h5uTo5OGK_vqMOvkecHOxCS48dX1lv72q1OvZwnPfla49Bp0NPrhQE5lMwrSGfEaZf5UyfvYz794",
      VAPID_PRIVATE_KEY: "GjxYHPPpZ5pYllCf_muvNp2Msfnk5hMDIHhTZ-N3xpY",
      VAPID_SUBJECT: "mailto:test@gymos.app",
    },
  },
});
