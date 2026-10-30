import { describe, expect, it } from "vitest";
import { InvalidMuscleGroupError } from "../service/errors.mts";
import { toExercise } from "./mapping.mts";

const exercise = {
  id: "3f2f0c1a-9b2d-4c3e-8a41-5d6e7f8091a2",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
};

describe("toExercise", () => {
  it("maps a valid exercise", () => {
    expect(toExercise(exercise)).toEqual(exercise);
  });

  it("rejects an unknown muscle group", () => {
    const invalid = { ...exercise, muscleGroup: "quads" };

    expect(() => toExercise(invalid)).toThrow(InvalidMuscleGroupError);
    expect(() => toExercise(invalid)).toThrow(/quads/);
  });
});
