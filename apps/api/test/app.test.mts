import { describe, expect, it } from "vitest";
import { app } from "../src/index.mts";

describe("GymOS API Server", () => {
  it("responds with ok on /health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string; service: string };
    expect(data.status).toBe("ok");
    expect(data.service).toBe("GymOS API");
  });

  it("returns exercise list on /api/gym/exercises", async () => {
    const res = await app.request("/api/gym/exercises");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { exercises: Array<{ id: string; name: string }> };
    expect(Array.isArray(data.exercises)).toBe(true);
    expect(data.exercises.length).toBeGreaterThan(0);
  });
});
