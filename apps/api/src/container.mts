import { ExerciseRepository } from "./modules/gym/repository/exercise-repository.mts";
import { PlanRepository } from "./modules/gym/repository/plan-repository.mts";
import { RotationRepository } from "./modules/gym/repository/rotation-repository.mts";
import { SessionRepository } from "./modules/gym/repository/session-repository.mts";
import { GymReadService } from "./modules/gym/service/read-service.mts";
import { GymWriteService } from "./modules/gym/service/write-service.mts";
import { CurrentUserService } from "./security/current-user.mts";

const exerciseRepository = new ExerciseRepository();
const planRepository = new PlanRepository();
const rotationRepository = new RotationRepository();
const sessionRepository = new SessionRepository();

const readService = new GymReadService(
  exerciseRepository,
  planRepository,
  sessionRepository,
  rotationRepository
);
const writeService = new GymWriteService(
  exerciseRepository,
  planRepository,
  sessionRepository,
  rotationRepository,
  readService
);

export const container = {
  readService,
  writeService,
  currentUserService: new CurrentUserService(),
};
