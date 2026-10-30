import type {
  CreateExerciseInput,
  CreateWorkoutPlanInput,
  CreateWorkoutSessionInput,
  CreateWorkoutSetInput,
  Exercise,
  LoggedSet,
  UpdateExerciseInput,
  UpdateWorkoutPlanInput,
  UpdateWorkoutRotationInput,
  WorkoutPlan,
  WorkoutRotation,
  WorkoutSessionDetail,
} from "@gymos/shared";
import type { ExerciseRepository } from "../repository/exercise-repository.mts";
import type { PlanRepository } from "../repository/plan-repository.mts";
import type { RotationRepository } from "../repository/rotation-repository.mts";
import type { SessionRepository } from "../repository/session-repository.mts";
import {
  ActiveSessionExistsError,
  DuplicateSetError,
  NotFoundError,
  SessionCompletedError,
  UnknownExerciseError,
  UnknownPlanError,
} from "./errors.mts";
import type { GymReadService } from "./read-service.mts";

type ExerciseWriter = Pick<
  ExerciseRepository,
  "findIds" | "create" | "update" | "softDelete"
>;
type PlanWriter = Pick<
  PlanRepository,
  "findById" | "create" | "update" | "delete"
>;
type RotationWriter = Pick<RotationRepository, "replace">;
type SessionWriter = Pick<
  SessionRepository,
  "createIfNoActive" | "logSet" | "completeIfOpen"
>;
type RotationReader = Pick<GymReadService, "getRotation">;

export class GymWriteService {
  constructor(
    private readonly exerciseRepository: ExerciseWriter,
    private readonly planRepository: PlanWriter,
    private readonly sessionRepository: SessionWriter,
    private readonly rotationRepository: RotationWriter,
    private readonly readService: RotationReader
  ) {}

  async createExercise(input: CreateExerciseInput): Promise<Exercise> {
    return this.exerciseRepository.create(input);
  }

  async updateExercise(
    exerciseId: string,
    input: UpdateExerciseInput
  ): Promise<Exercise> {
    const exercise = await this.exerciseRepository.update(exerciseId, input);
    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }
    return exercise;
  }

  async deleteExercise(exerciseId: string): Promise<Exercise> {
    const exercise = await this.exerciseRepository.softDelete(exerciseId);
    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }
    return exercise;
  }

  async createPlan(
    userId: string,
    input: CreateWorkoutPlanInput
  ): Promise<WorkoutPlan> {
    await this.assertExercisesExist(input.exercises);
    return this.planRepository.create(userId, input);
  }

  async updatePlan(
    userId: string,
    planId: string,
    input: UpdateWorkoutPlanInput
  ): Promise<WorkoutPlan> {
    const current = await this.planRepository.findById(userId, planId);
    if (!current) {
      throw new NotFoundError("Plan not found");
    }

    await this.assertExercisesExist(
      input.exercises,
      current.exercises.map((entry) => entry.exercise.id)
    );

    const plan = await this.planRepository.update(userId, planId, input);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }
    return plan;
  }

  async deletePlan(userId: string, planId: string): Promise<void> {
    const deleted = await this.planRepository.delete(userId, planId);
    if (!deleted) {
      throw new NotFoundError("Plan not found");
    }
  }

  async setRotation(
    userId: string,
    input: UpdateWorkoutRotationInput
  ): Promise<WorkoutRotation> {
    const result = await this.rotationRepository.replace(userId, input.planIds);
    if (result.kind === "unknown_plans") {
      throw new UnknownPlanError(
        `Unknown plan IDs: ${result.planIds.join(", ")}`
      );
    }

    return this.readService.getRotation(userId);
  }

  private async assertExercisesExist(
    exercises: Array<{ exerciseId: string }>,
    alreadyInPlan: string[] = []
  ): Promise<void> {
    const requestedIds = [
      ...new Set(exercises.map((exercise) => exercise.exerciseId)),
    ];
    const activeIds = await this.exerciseRepository.findIds(requestedIds);
    const knownIds = new Set([...alreadyInPlan, ...activeIds]);
    const missing = requestedIds.filter((id) => !knownIds.has(id));

    if (missing.length > 0) {
      throw new UnknownExerciseError(`Unknown exercise IDs: ${missing.join(", ")}`);
    }
  }

  async startSession(
    userId: string,
    input: CreateWorkoutSessionInput
  ): Promise<WorkoutSessionDetail> {
    let planId: string | null = null;
    let title = input.title;

    if (input.planId) {
      const plan = await this.planRepository.findById(userId, input.planId);
      if (!plan) {
        throw new NotFoundError("Plan not found");
      }
      planId = plan.id;
      title = title ?? plan.name;
    }

    const session = await this.sessionRepository.createIfNoActive(userId, {
      title: title ?? "Free Workout",
      planId,
    });

    if (!session) {
      throw new ActiveSessionExistsError(
        "An active session is already in progress"
      );
    }

    return session;
  }

  async logSet(
    userId: string,
    sessionId: string,
    input: CreateWorkoutSetInput
  ): Promise<LoggedSet> {
    const result = await this.sessionRepository.logSet(userId, sessionId, input);

    switch (result.kind) {
      case "created":
        return result.set;
      case "not_found":
        throw new NotFoundError("Session not found");
      case "completed":
        throw new SessionCompletedError("Session is already completed");
      case "unknown_exercise":
        throw new UnknownExerciseError(`Unknown exercise ID: ${input.exerciseId}`);
      case "duplicate":
        throw new DuplicateSetError("Set was already logged, retry");
    }
  }

  async completeSession(
    userId: string,
    sessionId: string
  ): Promise<WorkoutSessionDetail> {
    const result = await this.sessionRepository.completeIfOpen(userId, sessionId);

    switch (result.kind) {
      case "completed":
        return result.session;
      case "not_found":
        throw new NotFoundError("Session not found");
      case "already_completed":
        throw new SessionCompletedError("Session is already completed");
    }
  }
}
