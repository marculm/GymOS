import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalUserEmail = process.env.GYMOS_USER_EMAIL;
const originalVapid = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};
const originalDeepSeek = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: process.env.DEEPSEEK_BASE_URL,
  model: process.env.DEEPSEEK_TEXT_MODEL,
  visionModel: process.env.DEEPSEEK_VISION_MODEL,
  thinking: process.env.DEEPSEEK_THINKING,
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
  restore("DEEPSEEK_API_KEY", originalDeepSeek.apiKey);
  restore("DEEPSEEK_BASE_URL", originalDeepSeek.baseUrl);
  restore("DEEPSEEK_TEXT_MODEL", originalDeepSeek.model);
  restore("DEEPSEEK_VISION_MODEL", originalDeepSeek.visionModel);
  restore("DEEPSEEK_THINKING", originalDeepSeek.thinking);
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

  it("leaves DeepSeek unconfigured without a key", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    vi.resetModules();

    const { deepSeekConfig } = await import("./env.mts");

    expect(deepSeekConfig()).toBeNull();
  });

  it("builds DeepSeek config with defaults and overrides", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.resetModules();
    const defaults = await import("./env.mts");
    expect(defaults.deepSeekConfig()).toEqual({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      textModel: "deepseek-flash",
      visionModel: "deepseek-flash",
      thinking: true,
    });

    process.env.DEEPSEEK_BASE_URL = "https://ai.test";
    process.env.DEEPSEEK_TEXT_MODEL = "custom-text";
    process.env.DEEPSEEK_VISION_MODEL = "custom-vision";
    vi.resetModules();
    const overrides = await import("./env.mts");
    expect(overrides.deepSeekConfig()).toEqual({
      apiKey: "test-key",
      baseUrl: "https://ai.test",
      textModel: "custom-text",
      visionModel: "custom-vision",
      thinking: true,
    });
  });

  it("treats empty DeepSeek overrides as defaults", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_BASE_URL = "";
    process.env.DEEPSEEK_TEXT_MODEL = "";
    process.env.DEEPSEEK_VISION_MODEL = "";
    process.env.DEEPSEEK_THINKING = "";
    vi.resetModules();

    const { deepSeekConfig } = await import("./env.mts");

    expect(deepSeekConfig()).toEqual({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      textModel: "deepseek-flash",
      visionModel: "deepseek-flash",
      thinking: true,
    });
  });

  it("disables DeepSeek thinking from the environment", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_THINKING = "false";
    vi.resetModules();

    const { deepSeekConfig } = await import("./env.mts");

    expect(deepSeekConfig()?.thinking).toBe(false);
  });
});
