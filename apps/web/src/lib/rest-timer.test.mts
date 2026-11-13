import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REST_SECONDS,
  formatRestTime,
  loadRestSeconds,
  REST_PRESETS,
  saveRestSeconds,
} from "./rest-timer.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rest timer settings", () => {
  it("formats a countdown", () => {
    expect(formatRestTime(0)).toBe("0:00");
    expect(formatRestTime(120)).toBe("2:00");
    expect(formatRestTime(150)).toBe("2:30");
    expect(formatRestTime(185)).toBe("3:05");
  });

  it("offers the default presets", () => {
    expect(REST_PRESETS).toEqual([120, 150, 180]);
    expect(DEFAULT_REST_SECONDS).toBe(150);
  });

  it("falls back to 2:30 when storage is unavailable", () => {
    expect(loadRestSeconds()).toBe(150);
  });

  it("saves and reads the default", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });

    saveRestSeconds(180);

    expect(data.get("gymos.restTimerSeconds")).toBe("180");
    expect(loadRestSeconds()).toBe(180);
  });

  it("ignores an unknown stored value", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    data.set("gymos.restTimerSeconds", "999");

    expect(loadRestSeconds()).toBe(150);
  });
});
