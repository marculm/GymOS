import { describe, expect, it } from "vitest";
import {
  CreateWorkoutPlanSchema,
  CreateWorkoutSetSchema,
  WorkoutSessionDetailSchema,
} from "./workout.mts";

describe("CreateWorkoutPlanSchema", () => {
  it("accepts a plan with one exercise", () => {
    const result = CreateWorkoutPlanSchema.safeParse({
      name: "Push Day",
      exercises: [{ exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 4, targetReps: 8 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty exercise list", () => {
    expect(CreateWorkoutPlanSchema.safeParse({ name: "Empty", exercises: [] }).success).toBe(false);
  });
});

describe("CreateWorkoutSetSchema", () => {
  it("accepts bodyweight sets with zero weight", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects RPE above 10", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 20,
      rpe: 11,
    });
    expect(result.success).toBe(false);
  });
});

describe("WorkoutSessionDetailSchema", () => {
  it("accepts ISO timestamps and a null completion time", () => {
    const result = WorkoutSessionDetailSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000002",
      title: "Push Day",
      planId: null,
      startedAt: "2026-10-26T18:00:00.000Z",
      completedAt: null,
      sets: [],
    });
    expect(result.success).toBe(true);
  });
});
