import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, WorkoutPlan } from "@gymos/shared";
import {
  getRotation,
  listAllExercises,
  listAllPlans,
  updateExercise,
} from "../../api/gym.mts";
import { gymData } from "./gym-data.svelte.ts";

vi.mock("../../api/gym.mts", () => ({
  listAllExercises: vi.fn(),
  listAllPlans: vi.fn(),
  getRotation: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  setRotation: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
}));

const exercise: Exercise = {
  id: "ex-1",
  name: "Barbell Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
  createdAt: "2026-11-13T18:00:00.000Z",
  exercises: [
    {
      id: "plan-ex-1",
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: 80,
      notes: null,
      exercise,
    },
  ],
};

beforeEach(() => {
  gymData.reset();
  vi.clearAllMocks();
  vi.mocked(listAllExercises).mockResolvedValue([exercise]);
  vi.mocked(listAllPlans).mockResolvedValue([plan]);
  vi.mocked(getRotation).mockResolvedValue({
    plans: [plan],
    nextPlanId: plan.id,
  });
});

describe("gym data", () => {
  it("loads the next plan", async () => {
    await gymData.load();

    expect(gymData.nextPlan?.id).toBe(plan.id);
  });

  it("keeps plan targets in sync after editing an exercise", async () => {
    const updated: Exercise = {
      ...exercise,
      defaultSets: 5,
      defaultReps: 10,
      defaultWeightKg: 85,
    };
    vi.mocked(updateExercise).mockResolvedValue(updated);
    await gymData.load();

    await gymData.updateExercise(exercise.id, {
      name: updated.name,
      muscleGroup: updated.muscleGroup,
      defaultSets: updated.defaultSets,
      defaultReps: updated.defaultReps,
      defaultWeightKg: updated.defaultWeightKg,
    });

    const entry = gymData.plans[0]?.exercises[0];
    expect(entry?.targetSets).toBe(5);
    expect(entry?.targetReps).toBe(10);
    expect(entry?.targetWeightKg).toBe(85);
  });

  it("reports a load error", async () => {
    vi.mocked(getRotation).mockRejectedValueOnce(new Error("offline"));

    await gymData.load();

    expect(gymData.error).toBe("offline");
    expect(gymData.loading).toBe(false);
  });
});
