import { describe, expect, it } from "vitest";
import { deriveDefaultsByExercise } from "./exercise-defaults.mts";

function session(
  ...sets: Array<[exerciseId: string, weightKg: number, reps: number]>
) {
  return {
    sets: sets.map(([exerciseId, weightKg, reps]) => ({
      exerciseId,
      weightKg,
      reps,
    })),
  };
}

describe("deriveDefaultsByExercise", () => {
  it("returns nothing without completed sets", () => {
    expect(deriveDefaultsByExercise([])).toEqual(new Map());
  });

  it("uses one completed session", () => {
    const defaults = deriveDefaultsByExercise([
      session(["exercise-1", 60, 8], ["exercise-1", 61, 6]),
    ]);

    expect(defaults.get("exercise-1")).toEqual({
      defaultWeightKg: 60.5,
      defaultReps: 7,
    });
  });

  it("combines only the last two sessions containing the exercise", () => {
    const defaults = deriveDefaultsByExercise([
      session(["exercise-1", 100, 5], ["exercise-1", 100, 6]),
      session(["exercise-1", 100, 4]),
      session(["exercise-1", 100, 20]),
    ]);

    expect(defaults.get("exercise-1")).toEqual({
      defaultWeightKg: 100,
      defaultReps: 5,
    });
  });

  it("ignores sessions without sets for the exercise", () => {
    const defaults = deriveDefaultsByExercise([
      session(["other-exercise", 50, 10]),
      session(["exercise-1", 100, 5]),
      session(["exercise-1", 100, 20]),
    ]);

    expect(defaults.get("exercise-1")).toEqual({
      defaultWeightKg: 100,
      defaultReps: 13,
    });
  });

  it("takes reps only from sets near the rounded weight", () => {
    const defaults = deriveDefaultsByExercise([
      session(
        ["exercise-1", 90, 5],
        ["exercise-1", 90, 6],
        ["exercise-1", 95, 2]
      ),
    ]);

    expect(defaults.get("exercise-1")).toEqual({
      defaultWeightKg: 91.5,
      defaultReps: 6,
    });
  });

  it("falls back to every set when no weight is near the target", () => {
    const defaults = deriveDefaultsByExercise([
      session(
        ["exercise-1", 40, 12],
        ["exercise-1", 100, 5],
        ["exercise-1", 100, 6]
      ),
    ]);

    expect(defaults.get("exercise-1")).toEqual({
      defaultWeightKg: 80,
      defaultReps: 8,
    });
  });
});
