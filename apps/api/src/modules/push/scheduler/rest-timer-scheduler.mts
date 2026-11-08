import { getLogger } from "../../../logger/logger.mts";
import type { RestTimerRepository } from "../repository/rest-timer-repository.mts";
import type { PushService } from "../service/push-service.mts";

type RestTimerSource = Pick<RestTimerRepository, "findDue" | "deleteById">;
type RestPushSender = Pick<PushService, "sendRestOver">;

const logger = getLogger("RestTimerScheduler");

export class RestTimerScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly timers: RestTimerSource,
    private readonly push: RestPushSender,
    private readonly intervalMs = 1000
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const due = await this.timers.findDue(now);
      for (const timer of due) {
        try {
          await this.push.sendRestOver(timer.userId);
          logger.info(
            { timerId: timer.id, userId: timer.userId },
            "Rest timer push dispatched"
          );
        } catch (error) {
          logger.error(
            { err: error, timerId: timer.id },
            "Rest timer push failed"
          );
        } finally {
          await this.timers.deleteById(timer.id);
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Rest timer scheduler tick failed");
    } finally {
      this.running = false;
    }
  }
}
