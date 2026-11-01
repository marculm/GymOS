import { describe, expect, it } from "vitest";
import {
  CreateExerciseSchema,
  CreateWorkoutPlanSchema,
  CreateWorkoutSetSchema,
  DUPLICATE_ROTATION_PLAN_MESSAGE,
  LoggedSetSchema,
  UpdateExerciseSchema,
  UpdateWorkoutRotationSchema,
  WorkoutSessionDetailSchema,
} from "./workout.mts";

describe("CreateExerciseSchema", () => {
  it("accepts an exercise with only a name and muscle group", () => {
    expect(
      CreateExerciseSchema.safeParse({ name: "Cable Fly", muscleGroup: "chest" })
        .success
    ).toBe(true);
  });

  it("accepts defaults and an optional description", () => {
    const result = CreateExerciseSchema.safeParse({
      name: "Cable Fly",
      muscleGroup: "chest",
      description: "Pec isolation",
      defaultSets: 4,
      defaultReps: 12,
      defaultWeightKg: 15,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown muscle group", () => {
    expect(
      CreateExerciseSchema.safeParse({ name: "Fly", muscleGroup: "neck" }).success
    ).toBe(false);
  });

  it("rejects invalid limits", () => {
    const base = { name: "Fly", muscleGroup: "chest" };
    expect(CreateExerciseSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(CreateExerciseSchema.safeParse({ ...base, defaultSets: 21 }).success).toBe(false);
    expect(CreateExerciseSchema.safeParse({ ...base, defaultReps: 101 }).success).toBe(false);
    expect(
      CreateExerciseSchema.safeParse({ ...base, defaultWeightKg: -1 }).success
    ).toBe(false);
  });

  it("accepts a full update", () => {
    expect(
      UpdateExerciseSchema.safeParse({
        name: "Cable Fly",
        muscleGroup: "chest",
        description: null,
        defaultSets: 3,
        defaultReps: 10,
        defaultWeightKg: null,
      }).success
    ).toBe(true);
  });
});

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

describe("UpdateWorkoutRotationSchema", () => {
  it("accepts an ordered list of plans", () => {
    const result = UpdateWorkoutRotationSchema.safeParse({
      planIds: [crypto.randomUUID(), crypto.randomUUID()],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty list to clear the rotation", () => {
    expect(UpdateWorkoutRotationSchema.safeParse({ planIds: [] }).success).toBe(true);
  });

  it("rejects duplicate plans", () => {
    const planId = crypto.randomUUID();
    const result = UpdateWorkoutRotationSchema.safeParse({
      planIds: [planId, planId],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      DUPLICATE_ROTATION_PLAN_MESSAGE
    );
  });

  it("rejects more than 50 plans", () => {
    const planIds = Array.from({ length: 51 }, () => crypto.randomUUID());
    expect(UpdateWorkoutRotationSchema.safeParse({ planIds }).success).toBe(false);
  });

  it("rejects non-UUID plan IDs", () => {
    expect(
      UpdateWorkoutRotationSchema.safeParse({ planIds: ["push-day"] }).success
    ).toBe(false);
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

  it("ignores an rpe sent by an older client", () => {
    const result = CreateWorkoutSetSchema.parse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 20,
      rpe: 9,
    });
    expect(result).not.toHaveProperty("rpe");
  });
});

describe("LoggedSetSchema", () => {
  const set = {
    id: "00000000-0000-4000-8000-000000000003",
    exerciseId: "00000000-0000-4000-8000-000000000001",
    exerciseName: "Bench Press",
    setNumber: 1,
    reps: 8,
    weightKg: 80,
    createdAt: "2026-10-26T18:05:00.000Z",
  };

  it("accepts a set with its exercise name", () => {
    expect(LoggedSetSchema.safeParse(set).success).toBe(true);
  });

  it("rejects a set without an exercise name", () => {
    const { exerciseName: _omitted, ...withoutName } = set;
    expect(LoggedSetSchema.safeParse(withoutName).success).toBe(false);
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
