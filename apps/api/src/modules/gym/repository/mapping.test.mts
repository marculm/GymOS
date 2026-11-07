import { describe, expect, it } from "vitest";
import { InvalidMuscleGroupError } from "../service/errors.mts";
import { toExercise, toPlan } from "./mapping.mts";

const exercise = {
  id: "3f2f0c1a-9b2d-4c3e-8a41-5d6e7f8091a2",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: null,
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

function buildPlan(defaultWeightKg: number | null) {
  const createdAt = new Date("2026-11-06T12:00:00.000Z");
  const planId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

  return {
    id: planId,
    userId: "user-1",
    name: "Push",
    description: null,
    createdAt,
    updatedAt: createdAt,
    exercises: [
      {
        id: "7c5f2a1e-4d3b-4a6f-9e8d-1b2c3d4e5f60",
        planId,
        exerciseId: exercise.id,
        position: 0,
        notes: null,
        exercise: {
          ...exercise,
          defaultSets: 5,
          defaultReps: 12,
          defaultWeightKg,
          deletedAt: null,
          createdAt,
        },
      },
    ],
  };
}

describe("toPlan", () => {
  it("derives targets from the exercise defaults", () => {
    const plan = buildPlan(42.5);

    expect(toPlan(plan)).toMatchObject({
      id: plan.id,
      exercises: [
        {
          position: 0,
          targetSets: 5,
          targetReps: 12,
          targetWeightKg: 42.5,
        },
      ],
    });
  });

  it("keeps a null target weight", () => {
    expect(toPlan(buildPlan(null)).exercises[0]?.targetWeightKg).toBeNull();
  });
});
