import type {
  CreateWorkoutPlanInput,
  CreateWorkoutSessionInput,
  CreateWorkoutSetInput,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import type { ExerciseRepository } from "../repository/exercise-repository.mts";
import type { PlanRepository } from "../repository/plan-repository.mts";
import type { SessionRepository } from "../repository/session-repository.mts";
import {
  ActiveSessionExistsError,
  DuplicateSetError,
  NotFoundError,
  SessionCompletedError,
  UnknownExerciseError,
} from "./errors.mts";

type ExerciseReader = Pick<ExerciseRepository, "findIds">;
type PlanReader = Pick<PlanRepository, "findById" | "create">;
type SessionWriter = Pick<
  SessionRepository,
  "createIfNoActive" | "logSet" | "completeIfOpen"
>;

export class GymWriteService {
  constructor(
    private readonly exerciseRepository: ExerciseReader,
    private readonly planRepository: PlanReader,
    private readonly sessionRepository: SessionWriter
  ) {}

  async createPlan(
    userId: string,
    input: CreateWorkoutPlanInput
  ): Promise<WorkoutPlan> {
    const requestedIds = [
      ...new Set(input.exercises.map((exercise) => exercise.exerciseId)),
    ];
    const existingIds = await this.exerciseRepository.findIds(requestedIds);
    const missing = requestedIds.filter((id) => !existingIds.includes(id));

    if (missing.length > 0) {
      throw new UnknownExerciseError(`Unknown exercise IDs: ${missing.join(", ")}`);
    }

    return this.planRepository.create(userId, input);
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
