import type {
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import type { ExerciseRepository } from "../repository/exercise-repository.mts";
import type { PlanRepository } from "../repository/plan-repository.mts";
import type { SessionRepository } from "../repository/session-repository.mts";
import { NotFoundError } from "./errors.mts";
import { skipTake, type Pageable } from "./pageable.mts";
import type { PlanSearchParams, SessionSearchParams } from "./search-params.mts";
import type { Slice } from "./slice.mts";

type ExerciseReader = Pick<ExerciseRepository, "findAll" | "count">;
type PlanReader = Pick<PlanRepository, "findByUser" | "countByUser">;
type SessionReader = Pick<
  SessionRepository,
  "findActive" | "findById" | "findRecent" | "countRecent"
>;

export class GymReadService {
  constructor(
    private readonly exerciseRepository: ExerciseReader,
    private readonly planRepository: PlanReader,
    private readonly sessionRepository: SessionReader
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
