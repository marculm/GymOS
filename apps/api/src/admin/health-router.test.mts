import { describe, expect, it, vi } from "vitest";

const { findUnique, OWNER_EMAIL } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  OWNER_EMAIL: "owner@gymos.app",
}));

vi.mock("../config/prisma-client.mts", () => ({
  prisma: { user: { findUnique } },
}));

vi.mock("../config/env.mts", () => ({
  currentUserEmail: () => OWNER_EMAIL,
}));

import { healthRouter } from "./health-router.mts";

describe("healthRouter", () => {
  it("answers liveness without touching the database", async () => {
    const res = await healthRouter.request("/liveness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "up" });
  });

  it("returns 200 when the configured user exists", async () => {
    findUnique.mockResolvedValueOnce({ id: "user-1", email: OWNER_EMAIL });

    const res = await healthRouter.request("/readiness");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "up" });
    expect(findUnique).toHaveBeenCalledWith({ where: { email: OWNER_EMAIL } });
  });

  it("returns 503 problem details when the configured user is missing", async () => {
    findUnique.mockResolvedValueOnce(null);

    const res = await healthRouter.request("/readiness");

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(findUnique).toHaveBeenCalledWith({ where: { email: OWNER_EMAIL } });

    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe("Configured user not found");
    expect(JSON.stringify(body)).not.toContain(OWNER_EMAIL);
  });

  it("returns 503 without database details when readiness fails", async () => {
    findUnique.mockRejectedValueOnce(new Error("database down"));

    const res = await healthRouter.request("/readiness");

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(await res.text()).not.toContain("database down");
  });
});
