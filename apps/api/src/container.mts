import { vapidConfig } from "./config/env.mts";
import { ExerciseRepository } from "./modules/gym/repository/exercise-repository.mts";
import { PlanRepository } from "./modules/gym/repository/plan-repository.mts";
import { RotationRepository } from "./modules/gym/repository/rotation-repository.mts";
import { SessionRepository } from "./modules/gym/repository/session-repository.mts";
import { GymReadService } from "./modules/gym/service/read-service.mts";
import { GymWriteService } from "./modules/gym/service/write-service.mts";
import { RestTimerRepository } from "./modules/push/repository/rest-timer-repository.mts";
import { PushSubscriptionRepository } from "./modules/push/repository/subscription-repository.mts";
import { PushService } from "./modules/push/service/push-service.mts";
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

const pushService = new PushService(
  new PushSubscriptionRepository(),
  new RestTimerRepository(),
  vapidConfig()?.publicKey ?? null
);

export const container = {
  readService,
  writeService,
  pushService,
  currentUserService: new CurrentUserService(),
};
