import { describe, expect, it } from "vitest";
import { nextRotationPlanId } from "./rotation.mts";

const rotation = ["push", "pull", "legs"];

describe("nextRotationPlanId", () => {
  it("returns the first plan without history", () => {
    expect(nextRotationPlanId(rotation, null)).toBe("push");
  });

  it("returns the plan after the last completed plan", () => {
    expect(nextRotationPlanId(rotation, "push")).toBe("pull");
  });

  it("wraps to the first plan after the last item", () => {
    expect(nextRotationPlanId(rotation, "legs")).toBe("push");
  });

  it("falls back to the first plan when the last plan is not in the rotation", () => {
    expect(nextRotationPlanId(rotation, "arms")).toBe("push");
  });

  it("repeats a deviated plan with its next rotation item", () => {
    expect(nextRotationPlanId(rotation, "pull")).toBe("legs");
  });

  it("has no suggestion for an empty rotation", () => {
    expect(nextRotationPlanId([], null)).toBeNull();
    expect(nextRotationPlanId([], "push")).toBeNull();
  });
});
