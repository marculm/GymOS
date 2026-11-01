import { describe, expect, it, vi } from "vitest";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { NotFoundError } from "./errors.mts";
import { GymReadService } from "./read-service.mts";

const pageable = { number: 0, size: 20 };

const exercise: Exercise = {
  id: "exercise-1",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: null,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push",
  description: null,
  createdAt: "2026-10-26T18:00:00.000Z",
  exercises: [],
};

const secondPlan: WorkoutPlan = {
  ...plan,
  id: "plan-2",
  name: "Pull",
};

const detail: WorkoutSessionDetail = {
  id: "session-1",
  title: "Free Workout",
  planId: null,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

const summary: WorkoutSessionSummary = {
  id: "session-1",
  title: "Free Workout",
  planId: null,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: "2026-10-26T19:00:00.000Z",
  totalSets: 2,
};

function createService() {
  const exerciseRepository = {
    findAll: vi.fn(async (_params: { skip: number; take: number }) => [exercise]),
    count: vi.fn(async () => 1),
  };
  const planRepository = {
    findByUser: vi.fn(
      async (
        _userId: string,
        _params: { skip: number; take: number },
        _filters: unknown
      ) => [plan]
    ),
    countByUser: vi.fn(async (_userId: string, _filters: unknown) => 1),
  };
  const sessionRepository = {
    findActive: vi.fn(async (_userId: string) => null as WorkoutSessionDetail | null),
    findById: vi.fn(
      async (_userId: string, _sessionId: string) => null as WorkoutSessionDetail | null
    ),
    findRecent: vi.fn(
      async (
        _userId: string,
        _params: { skip: number; take: number },
        _filters: unknown
      ) => [summary]
    ),
    countRecent: vi.fn(async (_userId: string, _filters: unknown) => 1),
    findLastCompletedPlanId: vi.fn(
      async (_userId: string) => null as string | null
    ),
    findWeightSuggestions: vi.fn(async (_userId: string) => ({})),
    findCompleted: vi.fn(
      async (_userId: string) => [] as WorkoutSessionDetail[]
    ),
  };
  const rotationRepository = {
    findByUser: vi.fn(async (_userId: string) => [plan, secondPlan]),
  };

  return {
    service: new GymReadService(
      exerciseRepository,
      planRepository,
      sessionRepository,
      rotationRepository
    ),
    exerciseRepository,
    planRepository,
    sessionRepository,
    rotationRepository,
  };
}

describe("GymReadService", () => {
  it("lists exercises with skip and take", async () => {
    const { service, exerciseRepository } = createService();

    const slice = await service.listExercises(pageable);

    expect(slice).toEqual({ content: [exercise], totalElements: 1 });
    expect(exerciseRepository.findAll).toHaveBeenCalledWith({ skip: 0, take: 20 });
  });

  it("lists plans with user, pagination, and filters", async () => {
    const { service, planRepository } = createService();

    const slice = await service.listPlans("user-1", pageable, { name: "Push" });

    expect(slice).toEqual({ content: [plan], totalElements: 1 });
    expect(planRepository.findByUser).toHaveBeenCalledWith(
      "user-1",
      { skip: 0, take: 20 },
      { name: "Push" }
    );
    expect(planRepository.countByUser).toHaveBeenCalledWith("user-1", { name: "Push" });
  });

  it("returns the active session", async () => {
    const { service, sessionRepository } = createService();
    sessionRepository.findActive.mockResolvedValueOnce(detail);

    await expect(service.getActiveSession("user-1")).resolves.toEqual(detail);
  });

  it("throws NotFoundError when there is no active session", async () => {
    const { service } = createService();

    await expect(service.getActiveSession("user-1")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("lists sessions with filters", async () => {
    const { service, sessionRepository } = createService();
    const filters = { planId: "plan-1" };

    const slice = await service.listSessions("user-1", pageable, filters);

    expect(slice).toEqual({ content: [summary], totalElements: 1 });
    expect(sessionRepository.findRecent).toHaveBeenCalledWith(
      "user-1",
      { skip: 0, take: 20 },
      filters
    );
  });

  it("suggests the first rotation plan without history", async () => {
    const { service } = createService();

    await expect(service.getRotation("user-1")).resolves.toEqual({
      plans: [plan, secondPlan],
      nextPlanId: "plan-1",
    });
  });

  it("suggests the plan after the last completed plan", async () => {
    const { service, sessionRepository } = createService();
    sessionRepository.findLastCompletedPlanId.mockResolvedValueOnce("plan-1");

    await expect(service.getRotation("user-1")).resolves.toEqual({
      plans: [plan, secondPlan],
      nextPlanId: "plan-2",
    });
  });

  it("throws NotFoundError for an unknown session", async () => {
    const { service } = createService();

    await expect(service.getSession("user-1", "missing")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("returns weight suggestions for the user", async () => {
    const { service, sessionRepository } = createService();
    sessionRepository.findWeightSuggestions.mockResolvedValueOnce({
      "exercise-1": 61,
    });

    await expect(service.getWeightSuggestions("user-1")).resolves.toEqual({
      "exercise-1": 61,
    });
    expect(sessionRepository.findWeightSuggestions).toHaveBeenCalledWith(
      "user-1"
    );
  });

  it("aggregates personal records and volume from completed sessions", async () => {
    const { service, sessionRepository } = createService();
    sessionRepository.findCompleted.mockResolvedValueOnce([
      {
        id: "session-2",
        title: "Push A",
        planId: null,
        startedAt: "2026-10-27T18:00:00.000Z",
        completedAt: "2026-10-27T19:00:00.000Z",
        sets: [
          {
            id: "set-1",
            exerciseId: "exercise-1",
            exerciseName: "Bench Press",
            setNumber: 1,
            reps: 8,
            weightKg: 80,
            createdAt: "2026-10-27T18:05:00.000Z",
          },
          {
            id: "set-2",
            exerciseId: "exercise-1",
            exerciseName: "Bench Press",
            setNumber: 2,
            reps: 3,
            weightKg: 85,
            createdAt: "2026-10-27T18:10:00.000Z",
          },
          {
            id: "set-3",
            exerciseId: "exercise-2",
            exerciseName: "Squat",
            setNumber: 1,
            reps: 5,
            weightKg: 100,
            createdAt: "2026-10-27T18:15:00.000Z",
          },
        ],
      },
      {
        id: "session-1",
        title: "Push B",
        planId: null,
        startedAt: "2026-10-26T18:00:00.000Z",
        completedAt: "2026-10-26T19:00:00.000Z",
        sets: [
          {
            id: "set-4",
            exerciseId: "exercise-1",
            exerciseName: "Bench Press",
            setNumber: 1,
            reps: 5,
            weightKg: 90,
            createdAt: "2026-10-26T18:05:00.000Z",
          },
          {
            id: "set-5",
            exerciseId: "exercise-1",
            exerciseName: "Bench Press",
            setNumber: 2,
            reps: 2,
            weightKg: 90,
            createdAt: "2026-10-26T18:10:00.000Z",
          },
          {
            id: "set-6",
            exerciseId: "exercise-2",
            exerciseName: "Squat",
            setNumber: 1,
            reps: 8,
            weightKg: 100,
            createdAt: "2026-10-26T18:15:00.000Z",
          },
        ],
      },
    ]);

    const progress = await service.getProgress("user-1");

    expect(progress.personalRecords).toEqual([
      {
        exerciseId: "exercise-1",
        exerciseName: "Bench Press",
        weightKg: 90,
        reps: 5,
        achievedAt: "2026-10-26T18:05:00.000Z",
      },
      {
        exerciseId: "exercise-2",
        exerciseName: "Squat",
        weightKg: 100,
        reps: 8,
        achievedAt: "2026-10-26T18:15:00.000Z",
      },
    ]);
    expect(progress.volume).toEqual([
      {
        sessionId: "session-2",
        title: "Push A",
        startedAt: "2026-10-27T18:00:00.000Z",
        totalVolumeKg: 1395,
      },
      {
        sessionId: "session-1",
        title: "Push B",
        startedAt: "2026-10-26T18:00:00.000Z",
        totalVolumeKg: 1430,
      },
    ]);
    expect(sessionRepository.findCompleted).toHaveBeenCalledWith("user-1");
  });

  it("keeps the newest set when weight and reps tie", async () => {
    const { service, sessionRepository } = createService();
    const tiedSet = (id: string, createdAt: string) => ({
      id,
      exerciseId: "exercise-1",
      exerciseName: "Bench Press",
      setNumber: 1,
      reps: 8,
      weightKg: 80,
      createdAt,
    });
    sessionRepository.findCompleted.mockResolvedValueOnce([
      {
        ...detail,
        id: "session-2",
        sets: [tiedSet("set-1", "2026-10-27T18:05:00.000Z")],
      },
      {
        ...detail,
        id: "session-1",
        sets: [tiedSet("set-2", "2026-10-26T18:05:00.000Z")],
      },
    ]);

    const progress = await service.getProgress("user-1");

    expect(progress.personalRecords[0]?.achievedAt).toBe(
      "2026-10-27T18:05:00.000Z"
    );
  });

  it("returns empty progress without completed sessions", async () => {
    const { service } = createService();

    await expect(service.getProgress("user-1")).resolves.toEqual({
      personalRecords: [],
      volume: [],
    });
  });
});
