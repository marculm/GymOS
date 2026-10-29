import { describe, expect, it } from "vitest";
import { buildPlanWhere, buildSessionWhere } from "./where-builder.mts";

describe("buildPlanWhere", () => {
  it("scopes plans by user and name", () => {
    expect(buildPlanWhere("user-1", { name: "Push" })).toEqual({
      userId: "user-1",
      name: { contains: "Push", mode: "insensitive" },
    });
  });

  it("scopes plans by user only when no filter is given", () => {
    expect(buildPlanWhere("user-1")).toEqual({ userId: "user-1" });
  });
});

describe("buildSessionWhere", () => {
  it("scopes completed sessions by user, plan, and date range", () => {
    const from = new Date("2026-10-01T00:00:00.000Z");
    const to = new Date("2026-10-31T23:59:59.000Z");

    expect(
      buildSessionWhere("user-1", { planId: "plan-1", from, to })
    ).toEqual({
      userId: "user-1",
      completedAt: { not: null },
      planId: "plan-1",
      startedAt: { gte: from, lte: to },
    });
  });

  it("requires completion when no filter is given", () => {
    expect(buildSessionWhere("user-1")).toEqual({
      userId: "user-1",
      completedAt: { not: null },
    });
  });
});
