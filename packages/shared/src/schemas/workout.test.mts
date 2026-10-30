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

  it("accepts at most 50 exercises, 20 target sets, and 100 target reps", () => {
    const exercises = Array.from({ length: 50 }, () => ({
      exerciseId: crypto.randomUUID(),
      targetSets: 20,
      targetReps: 100,
    }));
    expect(CreateWorkoutPlanSchema.safeParse({ name: "Max", exercises }).success).toBe(true);
  });

  it("rejects more than 50 exercises", () => {
    const exercises = Array.from({ length: 51 }, () => ({
      exerciseId: crypto.randomUUID(),
      targetSets: 3,
      targetReps: 10,
    }));
    expect(CreateWorkoutPlanSchema.safeParse({ name: "Too many", exercises }).success).toBe(false);
  });

  it("rejects duplicate exercise IDs", () => {
    const result = CreateWorkoutPlanSchema.safeParse({
      name: "Repeated",
      exercises: [
        { exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 3, targetReps: 8 },
        { exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 4, targetReps: 10 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Each exercise can only be added once"
    );
  });

  it("rejects more than 20 target sets", () => {
    const result = CreateWorkoutPlanSchema.safeParse({
      name: "Too many sets",
      exercises: [
        { exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 21, targetReps: 10 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 target reps", () => {
    const result = CreateWorkoutPlanSchema.safeParse({
      name: "Too many reps",
      exercises: [
        { exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 3, targetReps: 101 },
      ],
    });
    expect(result.success).toBe(false);
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

  it("accepts reps and weight at their maxima", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 1000,
      weightKg: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects reps above the maximum", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 1001,
      weightKg: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects weight above the maximum", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 1000.5,
    });
    expect(result.success).toBe(false);
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
