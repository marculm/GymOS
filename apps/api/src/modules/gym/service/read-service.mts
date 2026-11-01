import type {
  Exercise,
  PersonalRecord,
  WeightSuggestions,
  WorkoutPlan,
  WorkoutProgress,
  WorkoutRotation,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import type { ExerciseRepository } from "../repository/exercise-repository.mts";
import type { PlanRepository } from "../repository/plan-repository.mts";
import type { RotationRepository } from "../repository/rotation-repository.mts";
import type { SessionRepository } from "../repository/session-repository.mts";
import { NotFoundError } from "./errors.mts";
import { skipTake, type Pageable } from "./pageable.mts";
import { nextRotationPlanId } from "./rotation.mts";
import type { PlanSearchParams, SessionSearchParams } from "./search-params.mts";
import type { Slice } from "./slice.mts";

type ExerciseReader = Pick<ExerciseRepository, "findAll" | "count">;
type PlanReader = Pick<PlanRepository, "findByUser" | "countByUser">;
type RotationReader = Pick<RotationRepository, "findByUser">;
type SessionReader = Pick<
  SessionRepository,
  | "findActive"
  | "findById"
  | "findRecent"
  | "countRecent"
  | "findLastCompletedPlanId"
  | "findWeightSuggestions"
  | "findCompleted"
>;

export class GymReadService {
  constructor(
    private readonly exerciseRepository: ExerciseReader,
    private readonly planRepository: PlanReader,
    private readonly sessionRepository: SessionReader,
    private readonly rotationRepository: RotationReader
  ) {}

  async listExercises(pageable: Pageable): Promise<Slice<Exercise>> {
    const [content, totalElements] = await Promise.all([
      this.exerciseRepository.findAll(skipTake(pageable)),
      this.exerciseRepository.count(),
    ]);
    return { content, totalElements };
  }

  async listPlans(
    userId: string,
    pageable: Pageable,
    filters: PlanSearchParams = {}
  ): Promise<Slice<WorkoutPlan>> {
    const [content, totalElements] = await Promise.all([
      this.planRepository.findByUser(userId, skipTake(pageable), filters),
      this.planRepository.countByUser(userId, filters),
    ]);
    return { content, totalElements };
  }

  async getRotation(userId: string): Promise<WorkoutRotation> {
    const [plans, lastPlanId] = await Promise.all([
      this.rotationRepository.findByUser(userId),
      this.sessionRepository.findLastCompletedPlanId(userId),
    ]);
    return {
      plans,
      nextPlanId: nextRotationPlanId(
        plans.map((plan) => plan.id),
        lastPlanId
      ),
    };
  }

  async getWeightSuggestions(userId: string): Promise<WeightSuggestions> {
    return this.sessionRepository.findWeightSuggestions(userId);
  }

  async getActiveSession(userId: string): Promise<WorkoutSessionDetail> {
    const session = await this.sessionRepository.findActive(userId);
    if (!session) {
      throw new NotFoundError("No active session");
    }
    return session;
  }

  async listSessions(
    userId: string,
    pageable: Pageable,
    filters: SessionSearchParams = {}
  ): Promise<Slice<WorkoutSessionSummary>> {
    const [content, totalElements] = await Promise.all([
      this.sessionRepository.findRecent(userId, skipTake(pageable), filters),
      this.sessionRepository.countRecent(userId, filters),
    ]);
    return { content, totalElements };
  }

  async getProgress(userId: string): Promise<WorkoutProgress> {
    const sessions = await this.sessionRepository.findCompleted(userId);
    const records = new Map<string, PersonalRecord>();

    for (const session of sessions) {
      for (const set of session.sets) {
        const current = records.get(set.exerciseId);
        const isBetter =
          current === undefined ||
          set.weightKg > current.weightKg ||
          (set.weightKg === current.weightKg && set.reps > current.reps);
        if (isBetter) {
          records.set(set.exerciseId, {
            exerciseId: set.exerciseId,
            exerciseName: set.exerciseName,
            weightKg: set.weightKg,
            reps: set.reps,
            achievedAt: set.createdAt,
          });
        }
      }
    }

    return {
      personalRecords: [...records.values()].sort((a, b) =>
        a.exerciseName.localeCompare(b.exerciseName)
      ),
      volume: sessions.map((session) => ({
        sessionId: session.id,
        title: session.title,
        startedAt: session.startedAt,
        totalVolumeKg: session.sets.reduce(
          (total, set) => total + set.reps * set.weightKg,
          0
        ),
      })),
    };
  }

  async getSession(
    userId: string,
    sessionId: string
  ): Promise<WorkoutSessionDetail> {
    const session = await this.sessionRepository.findById(userId, sessionId);
    if (!session) {
      throw new NotFoundError("Session not found");
    }
    return session;
  }
}
