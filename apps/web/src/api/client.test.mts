import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiTimeoutError, REQUEST_TIMEOUT_MS, api } from "./client.mts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("defaults to a 10 second timeout", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it("times out a request that never resolves", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    const request = api.get("/gym/rotation", { timeoutMs: 10 });

    await expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
    await expect(request).rejects.toThrow("timed out");
  });
});
