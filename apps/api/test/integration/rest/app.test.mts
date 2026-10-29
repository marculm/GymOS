import { describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";

describe("GymOS API Server", () => {
  it("answers liveness on /health/liveness and /health", async () => {
    for (const path of ["/health/liveness", "/health"]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "up" });
    }
  });

  it("answers readiness when the database is available", async () => {
    const res = await app.request("/health/readiness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "up" });
  });

  it("returns a page of exercises", async () => {
    const res = await app.request("/api/gym/exercises");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      content: Array<{ id: string; name: string }>;
      page: { size: number; number: number; totalElements: number; totalPages: number };
    };
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.page.number).toBe(0);
  });

  it("returns 501 for unimplemented nutrition", async () => {
    const res = await app.request("/api/nutrition/summary");
    expect(res.status).toBe(501);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("returns 501 for unimplemented extractor", async () => {
    const res = await app.request("/api/extractor/status");
    expect(res.status).toBe(501);
  });

  it("labels metrics with the matched route template", async () => {
    await app.request("/api/gym/sessions/00000000-0000-4000-8000-000000000001");
    await app.request("/api/gym/sessions/00000000-0000-4000-8000-000000000002");

    const res = await app.request("/prometheus");
    const text = await res.text();

    expect(text).toContain("http_requests_total");
    expect(text).toContain("/sessions/:id");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
  });

  it("returns problem details for an unknown route", async () => {
    const res = await app.request("/api/gym/typo");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/problem+json");

    const data = (await res.json()) as {
      title: string;
      status: number;
      detail: string;
      instance: string;
    };
    expect(data).toMatchObject({
      title: "Not Found",
      status: 404,
      detail: "Route not found",
      instance: "/api/gym/typo",
    });
  });
});
