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
  };

  return {
    service: new GymReadService(
      exerciseRepository,
      planRepository,
      sessionRepository
    ),
    exerciseRepository,
    planRepository,
    sessionRepository,
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

  it("throws NotFoundError for an unknown session", async () => {
    const { service } = createService();

    await expect(service.getSession("user-1", "missing")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
