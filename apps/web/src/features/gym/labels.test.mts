import { describe, expect, it } from "vitest";
import {
  DUPLICATE_EXERCISE_MESSAGE,
  DUPLICATE_ROTATION_PLAN_MESSAGE,
  MUSCLE_GROUPS,
} from "@gymos/shared/labels";

describe("shared labels subpath", () => {
  it("exposes the Zod-free constants", () => {
    expect(MUSCLE_GROUPS).toEqual([
      "chest",
      "back",
      "legs",
      "shoulders",
      "arms",
      "core",
    ]);
    expect(DUPLICATE_EXERCISE_MESSAGE).toBe(
      "Each exercise can only be added once"
    );
    expect(DUPLICATE_ROTATION_PLAN_MESSAGE).toBe(
      "Each plan can only appear once in the rotation"
    );
  });
});
