import { describe, expect, it, vi } from "vitest";
import type {
  Exercise,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import type {
  CompleteSessionResult,
  LogSetResult,
} from "../repository/session-repository.mts";
import {
  ActiveSessionExistsError,
  DuplicatePlanNameError,
  DuplicateSetError,
  NotFoundError,
  SessionCompletedError,
  UnknownExerciseError,
} from "./errors.mts";
import { GymWriteService } from "./write-service.mts";

const exerciseId = "00000000-0000-4000-8000-000000000001";

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push",
  description: null,
  createdAt: "2026-10-26T18:00:00.000Z",
  exercises: [],
};

const session: WorkoutSessionDetail = {
  id: "session-1",
  title: "Free Workout",
  planId: null,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

const loggedSet: LoggedSet = {
  id: "set-1",
  exerciseId,
  exerciseName: "Bench Press",
  setNumber: 1,
  reps: 10,
  weightKg: 20,
  rpe: null,
  createdAt: "2026-10-26T18:00:00.000Z",
};

const exercise: Exercise = {
  id: exerciseId,
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const exerciseInput = {
  name: "Bench Press",
  muscleGroup: "chest" as const,
};

function createService() {
  const exerciseRepository = {
    findIds: vi.fn(async (ids: string[]) => ids),
    create: vi.fn(async (_input: unknown) => exercise),
    update: vi.fn(async (_id: string, _input: unknown) => exercise as Exercise | null),
    softDelete: vi.fn(async (_id: string) => exercise as Exercise | null),
  };
  const planRepository = {
    findById: vi.fn(async (_userId: string, _planId: string) => null as WorkoutPlan | null),
    create: vi.fn(async (_userId: string, _input: unknown) => plan),
  };
  const sessionRepository = {
    createIfNoActive: vi.fn(
      async (_userId: string, _input: { title: string; planId: string | null }) =>
        null as WorkoutSessionDetail | null
    ),
    logSet: vi.fn(
      async (
        _userId: string,
        _sessionId: string,
        _input: { exerciseId: string; reps: number; weightKg: number; rpe?: number }
      ) => ({ kind: "created", set: loggedSet }) as LogSetResult
    ),
    completeIfOpen: vi.fn(
      async (_userId: string, _sessionId: string) =>
        ({ kind: "completed", session }) as CompleteSessionResult
    ),
  };

  return {
    service: new GymWriteService(
      exerciseRepository,
      planRepository,
      sessionRepository
    ),
    exerciseRepository,
    planRepository,
    sessionRepository,
  };
}

const planInput = {
  name: "Push",
  exercises: [{ exerciseId, targetSets: 3, targetReps: 10 }],
};

describe("GymWriteService", () => {
  it("creates an exercise", async () => {
    const { service, exerciseRepository } = createService();

    await expect(service.createExercise(exerciseInput)).resolves.toEqual(exercise);
    expect(exerciseRepository.create).toHaveBeenCalledWith(exerciseInput);
  });

  it("updates an exercise", async () => {
    const { service, exerciseRepository } = createService();

    await expect(
      service.updateExercise(exerciseId, exerciseInput)
    ).resolves.toEqual(exercise);
    expect(exerciseRepository.update).toHaveBeenCalledWith(
      exerciseId,
      exerciseInput
    );
  });

  it("rejects updating a missing exercise", async () => {
    const { service, exerciseRepository } = createService();
    exerciseRepository.update.mockResolvedValueOnce(null);

    await expect(
      service.updateExercise(exerciseId, exerciseInput)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("soft deletes an exercise", async () => {
    const { service, exerciseRepository } = createService();

    await expect(service.deleteExercise(exerciseId)).resolves.toEqual(exercise);
    expect(exerciseRepository.softDelete).toHaveBeenCalledWith(exerciseId);
  });

  it("rejects deleting a missing exercise", async () => {
    const { service, exerciseRepository } = createService();
    exerciseRepository.softDelete.mockResolvedValueOnce(null);

    await expect(service.deleteExercise(exerciseId)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("creates a plan when all exercises exist", async () => {
    const { service, planRepository } = createService();

    await expect(service.createPlan("user-1", planInput)).resolves.toEqual(plan);
    expect(planRepository.create).toHaveBeenCalledWith("user-1", planInput);
  });

  it("rejects unknown exercise IDs before writing", async () => {
    const { service, exerciseRepository, planRepository } = createService();
    exerciseRepository.findIds.mockResolvedValueOnce([]);

    await expect(service.createPlan("user-1", planInput)).rejects.toBeInstanceOf(
      UnknownExerciseError
    );
    expect(planRepository.create).not.toHaveBeenCalled();
  });

  it("propagates duplicate plan names from the repository", async () => {
    const { service, planRepository } = createService();
    planRepository.create.mockRejectedValueOnce(new DuplicatePlanNameError("duplicate"));

    await expect(service.createPlan("user-1", planInput)).rejects.toBeInstanceOf(
      DuplicatePlanNameError
    );
  });

  it("starts a free session when no session is active", async () => {
    const { service, sessionRepository } = createService();
    sessionRepository.createIfNoActive.mockResolvedValueOnce(session);

    await expect(service.startSession("user-1", {})).resolves.toEqual(session);
    expect(sessionRepository.createIfNoActive).toHaveBeenCalledWith("user-1", {
      title: "Free Workout",
      planId: null,
    });
  });

  it("uses the plan name as the default session title", async () => {
    const { service, planRepository, sessionRepository } = createService();
    planRepository.findById.mockResolvedValueOnce(plan);
    sessionRepository.createIfNoActive.mockResolvedValueOnce(session);

    await service.startSession("user-1", { planId: plan.id });

    expect(sessionRepository.createIfNoActive).toHaveBeenCalledWith("user-1", {
      title: "Push",
      planId: plan.id,
    });
  });

  it("rejects a missing plan", async () => {
    const { service } = createService();

    await expect(
      service.startSession("user-1", { planId: "missing" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a second active session", async () => {
    const { service } = createService();

    await expect(service.startSession("user-1", {})).rejects.toBeInstanceOf(
      ActiveSessionExistsError
    );
  });

  it("returns a created set", async () => {
    const { service } = createService();

    await expect(
      service.logSet("user-1", "session-1", {
        exerciseId,
        reps: 10,
        weightKg: 20,
      })
    ).resolves.toEqual(loggedSet);
  });

  it.each([
    ["not_found", NotFoundError],
    ["completed", SessionCompletedError],
    ["unknown_exercise", UnknownExerciseError],
    ["duplicate", DuplicateSetError],
  ] as const)("maps logSet result %s to an error", async (kind, error) => {
    const { service, sessionRepository } = createService();
    sessionRepository.logSet.mockResolvedValueOnce({ kind } as LogSetResult);

    await expect(
      service.logSet("user-1", "session-1", {
        exerciseId,
        reps: 10,
        weightKg: 20,
      })
    ).rejects.toBeInstanceOf(error);
  });

  it("returns a completed session", async () => {
    const { service } = createService();

    await expect(service.completeSession("user-1", "session-1")).resolves.toEqual(
      session
    );
  });

  it.each([
    ["not_found", NotFoundError],
    ["already_completed", SessionCompletedError],
  ] as const)("maps complete result %s to an error", async (kind, error) => {
    const { service, sessionRepository } = createService();
    sessionRepository.completeIfOpen.mockResolvedValueOnce({
      kind,
    } as CompleteSessionResult);

    await expect(
      service.completeSession("user-1", "session-1")
    ).rejects.toBeInstanceOf(error);
  });
});
