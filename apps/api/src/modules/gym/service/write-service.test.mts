import { describe, expect, it, vi } from "vitest";
import type {
  Exercise,
  LoggedSet,
  UpdateWorkoutPlanInput,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import type { ReplaceRotationResult } from "../repository/rotation-repository.mts";
import type {
  CompleteSessionResult,
  DeleteSetResult,
  LogSetResult,
  UpdateSetResult,
} from "../repository/session-repository.mts";
import {
  ActiveSessionExistsError,
  DuplicatePlanNameError,
  DuplicateSetError,
  NotFoundError,
  SessionCompletedError,
  SessionNotCompletedError,
  UnknownExerciseError,
  UnknownPlanError,
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

const rotation = { plans: [plan], nextPlanId: plan.id };

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
    update: vi.fn(
      async (_userId: string, _planId: string, _input: unknown) =>
        plan as WorkoutPlan | null
    ),
    delete: vi.fn(async (_userId: string, _planId: string) => true),
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
        _input: { exerciseId: string; reps: number; weightKg: number }
      ) => ({ kind: "created", set: loggedSet }) as LogSetResult
    ),
    completeIfOpen: vi.fn(
      async (_userId: string, _sessionId: string) =>
        ({ kind: "completed", session }) as CompleteSessionResult
    ),
    deleteSet: vi.fn(
      async (_userId: string, _sessionId: string, _setId: string) =>
        ({ kind: "deleted" }) as DeleteSetResult
    ),
    updateSet: vi.fn(
      async (
        _userId: string,
        _sessionId: string,
        _setId: string,
        _input: { reps: number; weightKg: number }
      ) => ({ kind: "updated", set: loggedSet }) as UpdateSetResult
    ),
  };

  const rotationRepository = {
    replace: vi.fn(
      async (
        _userId: string,
        _planIds: string[]
      ): Promise<ReplaceRotationResult> => ({ kind: "ok" })
    ),
    findByUser: vi.fn(async (_userId: string) => [plan]),
  };
  const readService = {
    getRotation: vi.fn(async (_userId: string) => rotation),
  };

  return {
    service: new GymWriteService(
      exerciseRepository,
      planRepository,
      sessionRepository,
      rotationRepository,
      readService
    ),
    exerciseRepository,
    planRepository,
    sessionRepository,
    rotationRepository,
    readService,
  };
}

const planInput = {
  name: "Push",
  exercises: [{ exerciseId }],
};

const planUpdate: UpdateWorkoutPlanInput = {
  name: "Push A",
  description: "Heavy",
  exercises: [{ exerciseId }],
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

  it("updates a plan when all exercises exist", async () => {
    const { service, planRepository } = createService();
    planRepository.findById.mockResolvedValueOnce(plan);

    await expect(
      service.updatePlan("user-1", "plan-1", planUpdate)
    ).resolves.toEqual(plan);
    expect(planRepository.update).toHaveBeenCalledWith(
      "user-1",
      "plan-1",
      planUpdate
    );
  });

  it("rejects updating a missing plan", async () => {
    const { service, planRepository } = createService();

    await expect(
      service.updatePlan("user-1", "plan-1", planUpdate)
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(planRepository.update).not.toHaveBeenCalled();
  });

  it("rejects unknown exercise IDs before updating", async () => {
    const { service, exerciseRepository, planRepository } = createService();
    planRepository.findById.mockResolvedValueOnce(plan);
    exerciseRepository.findIds.mockResolvedValueOnce([]);

    await expect(
      service.updatePlan("user-1", "plan-1", planUpdate)
    ).rejects.toBeInstanceOf(UnknownExerciseError);
    expect(planRepository.update).not.toHaveBeenCalled();
  });

  it("keeps an exercise already in the plan after it was deleted", async () => {
    const { service, exerciseRepository, planRepository } = createService();
    planRepository.findById.mockResolvedValueOnce({
      ...plan,
      exercises: [
        {
          id: "plan-exercise-1",
          position: 0,
          targetSets: 4,
          targetReps: 8,
          targetWeightKg: 80,
          notes: null,
          exercise,
        },
      ],
    });
    exerciseRepository.findIds.mockResolvedValueOnce([]);

    await expect(
      service.updatePlan("user-1", "plan-1", planUpdate)
    ).resolves.toEqual(plan);
    expect(planRepository.update).toHaveBeenCalledWith(
      "user-1",
      "plan-1",
      planUpdate
    );
  });

  it("deletes a plan", async () => {
    const { service, planRepository } = createService();

    await expect(service.deletePlan("user-1", "plan-1")).resolves.toBeUndefined();
    expect(planRepository.delete).toHaveBeenCalledWith("user-1", "plan-1");
  });

  it("rejects deleting a missing plan", async () => {
    const { service, planRepository } = createService();
    planRepository.delete.mockResolvedValueOnce(false);

    await expect(
      service.deletePlan("user-1", "plan-1")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("replaces the rotation and returns the suggestion", async () => {
    const { service, rotationRepository, readService } = createService();

    await expect(
      service.setRotation("user-1", { planIds: [plan.id] })
    ).resolves.toEqual(rotation);
    expect(rotationRepository.replace).toHaveBeenCalledWith("user-1", [plan.id]);
    expect(readService.getRotation).toHaveBeenCalledWith("user-1");
  });

  it("rejects unknown plans", async () => {
    const { service, rotationRepository, readService } = createService();
    rotationRepository.replace.mockResolvedValueOnce({
      kind: "unknown_plans",
      planIds: ["missing"],
    });

    await expect(
      service.setRotation("user-1", { planIds: ["missing"] })
    ).rejects.toBeInstanceOf(UnknownPlanError);
    expect(readService.getRotation).not.toHaveBeenCalled();
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

  it("deletes a logged set", async () => {
    const { service, sessionRepository } = createService();

    await expect(
      service.deleteSet("user-1", "session-1", "set-1")
    ).resolves.toBeUndefined();
    expect(sessionRepository.deleteSet).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      "set-1"
    );
  });

  it.each([
    ["not_found", NotFoundError],
    ["completed", SessionCompletedError],
  ] as const)("maps deleteSet result %s to an error", async (kind, error) => {
    const { service, sessionRepository } = createService();
    sessionRepository.deleteSet.mockResolvedValueOnce({
      kind,
    } as DeleteSetResult);

    await expect(
      service.deleteSet("user-1", "session-1", "set-1")
    ).rejects.toBeInstanceOf(error);
  });

  it("updates a logged set", async () => {
    const { service, sessionRepository } = createService();

    await expect(
      service.updateSet("user-1", "session-1", "set-1", {
        reps: 12,
        weightKg: 42.5,
      })
    ).resolves.toEqual(loggedSet);
    expect(sessionRepository.updateSet).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      "set-1",
      { reps: 12, weightKg: 42.5 }
    );
  });

  it.each([
    ["not_found", NotFoundError],
    ["active", SessionNotCompletedError],
  ] as const)("maps updateSet result %s to an error", async (kind, error) => {
    const { service, sessionRepository } = createService();
    sessionRepository.updateSet.mockResolvedValueOnce({
      kind,
    } as UpdateSetResult);

    await expect(
      service.updateSet("user-1", "session-1", "set-1", {
        reps: 12,
        weightKg: 42.5,
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
