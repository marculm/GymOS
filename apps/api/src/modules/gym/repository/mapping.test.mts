import { describe, expect, it } from "vitest";
import { InvalidMuscleGroupError, toExercise } from "./mapping.mts";

const exercise = {
  id: "exercise-1",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
};

describe("toExercise", () => {
  it("maps a valid muscle group", () => {
    expect(toExercise(exercise).muscleGroup).toBe("legs");
  });

  it("rejects an unknown muscle group", () => {
    const invalid = { ...exercise, muscleGroup: "quads" };

    expect(() => toExercise(invalid)).toThrow(InvalidMuscleGroupError);
    expect(() => toExercise(invalid)).toThrow(/quads/);
  });
});
