import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalUserEmail = process.env.GYMOS_USER_EMAIL;
const originalVapid = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("NODE_ENV", originalNodeEnv);
  restore("GYMOS_USER_EMAIL", originalUserEmail);
  restore("VAPID_PUBLIC_KEY", originalVapid.publicKey);
  restore("VAPID_PRIVATE_KEY", originalVapid.privateKey);
  restore("VAPID_SUBJECT", originalVapid.subject);
  vi.resetModules();
});

describe("env", () => {
  it("defaults NODE_ENV to production when it is unset", async () => {
    delete process.env.NODE_ENV;
    vi.resetModules();

    const { env } = await import("./env.mts");

    expect(env.NODE_ENV).toBe("production");
  });

  it("keeps an explicit development value", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();

    const { env } = await import("./env.mts");

    expect(env.NODE_ENV).toBe("development");
  });

  it("treats empty VAPID variables as unset", async () => {
    process.env.VAPID_PUBLIC_KEY = "";
    process.env.VAPID_PRIVATE_KEY = "";
    process.env.VAPID_SUBJECT = "";
    vi.resetModules();

    const { env, vapidConfig } = await import("./env.mts");

    expect(env.VAPID_PUBLIC_KEY).toBeUndefined();
    expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
    expect(env.VAPID_SUBJECT).toBe("mailto:admin@gymos.app");
    expect(vapidConfig()).toBeNull();
  });

  it("reads the current user email per request and ignores empty overrides", async () => {
    const { currentUserEmail, env } = await import("./env.mts");

    process.env.GYMOS_USER_EMAIL = "other@gymos.app";
    expect(currentUserEmail()).toBe("other@gymos.app");

    process.env.GYMOS_USER_EMAIL = "";
    expect(currentUserEmail()).toBe(env.GYMOS_USER_EMAIL);
  });
});
