import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalUserEmail = process.env.GYMOS_USER_EMAIL;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  if (originalUserEmail === undefined) {
    delete process.env.GYMOS_USER_EMAIL;
  } else {
    process.env.GYMOS_USER_EMAIL = originalUserEmail;
  }
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

  it("reads the current user email per request and ignores empty overrides", async () => {
    const { currentUserEmail, env } = await import("./env.mts");

    process.env.GYMOS_USER_EMAIL = "other@gymos.app";
    expect(currentUserEmail()).toBe("other@gymos.app");

    process.env.GYMOS_USER_EMAIL = "";
    expect(currentUserEmail()).toBe(env.GYMOS_USER_EMAIL);
  });
});
