import { describe, expect, it, vi } from "vitest";

const { count } = vi.hoisted(() => ({ count: vi.fn() }));

vi.mock("../config/prisma-client.mts", () => ({
  prisma: { user: { count } },
}));

import { healthRouter } from "./health-router.mts";

describe("healthRouter", () => {
  it("answers liveness without touching the database", async () => {
    const res = await healthRouter.request("/liveness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "up" });
  });

  it("returns 503 problem details when readiness fails", async () => {
    count.mockRejectedValueOnce(new Error("database down"));

    const res = await healthRouter.request("/readiness");

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
