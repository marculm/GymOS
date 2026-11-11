import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiTimeoutError, REQUEST_TIMEOUT_MS, api } from "./client.mts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  it("defaults to a 10 second timeout", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it("times out a request that never resolves", async () => {
    const fetchMock = vi.fn(
      (_path: string, _init: RequestInit) => new Promise<Response>(() => {})
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = api.get("/gym/rotation", { timeoutMs: 10 });

    await expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
    await expect(request).rejects.toThrow("timed out");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("times out a response body that never finishes", async () => {
    const fetchMock = vi.fn((_path: string, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          }),
      } as unknown as Response)
    );
    vi.stubGlobal("fetch", fetchMock);

    let fallback: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      api.get("/gym/rotation", { timeoutMs: 10 }).then(
        () => "resolved",
        (error: unknown) => error
      ),
      new Promise<"hung">((resolve) => {
        fallback = setTimeout(() => resolve("hung"), 200);
      }),
    ]);
    clearTimeout(fallback);

    expect(outcome).toBeInstanceOf(ApiTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a GET once after a server error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ title: "Server error" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/gym/rotation")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a GET once after a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/gym/rotation")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one GET retry", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => jsonResponse({ title: "Server error" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/gym/rotation")).rejects.toThrow("Server error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a GET after a client error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ title: "Bad request" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/gym/rotation")).rejects.toThrow("Bad request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never retries mutations after a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/gym/plans", {})).rejects.toThrow("Failed to fetch");
    await expect(api.put("/gym/plans/1", {})).rejects.toThrow("Failed to fetch");
    await expect(api.delete("/gym/plans/1")).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never retries mutations after a server error", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => jsonResponse({ title: "Server error" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/gym/plans", {})).rejects.toThrow("Server error");
    await expect(api.put("/gym/plans/1", {})).rejects.toThrow("Server error");
    await expect(api.delete("/gym/plans/1")).rejects.toThrow("Server error");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
