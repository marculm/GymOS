import { afterEach, describe, expect, it, vi } from "vitest";
import { RestTimerScheduler } from "./rest-timer-scheduler.mts";
import type { DueRestTimer } from "../repository/rest-timer-repository.mts";

function createScheduler(
  due: DueRestTimer[],
  sendRestOver = vi.fn().mockResolvedValue(undefined)
) {
  const timers = {
    findDue: vi.fn().mockResolvedValue(due),
    deleteById: vi.fn().mockResolvedValue(undefined),
  };

  return {
    scheduler: new RestTimerScheduler(timers, { sendRestOver }),
    timers,
    sendRestOver,
  };
}

describe("RestTimerScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends every due timer and deletes it", async () => {
    const now = new Date("2026-11-08T10:00:00.000Z");
    const due = [
      { id: "timer-1", userId: "user-1", endAt: now },
      { id: "timer-2", userId: "user-2", endAt: now },
    ];
    const { scheduler, timers, sendRestOver } = createScheduler(due);

    await scheduler.tick(now);

    expect(timers.findDue).toHaveBeenCalledExactlyOnceWith(now);
    expect(sendRestOver).toHaveBeenNthCalledWith(1, "user-1");
    expect(sendRestOver).toHaveBeenNthCalledWith(2, "user-2");
    expect(timers.deleteById).toHaveBeenNthCalledWith(1, "timer-1");
    expect(timers.deleteById).toHaveBeenNthCalledWith(2, "timer-2");
  });

  it("deletes a timer even when its push fails", async () => {
    const due = [{ id: "timer-1", userId: "user-1", endAt: new Date() }];
    const sendRestOver = vi
      .fn()
      .mockRejectedValueOnce(new Error("push service unavailable"));
    const { scheduler, timers } = createScheduler(due, sendRestOver);

    await scheduler.tick();

    expect(sendRestOver).toHaveBeenCalledOnce();
    expect(timers.deleteById).toHaveBeenCalledExactlyOnceWith("timer-1");
  });

  it("does not overlap ticks while one is running", async () => {
    let resolveFindDue: (timers: DueRestTimer[]) => void = () => {};
    const findDue = vi.fn(
      () =>
        new Promise<DueRestTimer[]>((resolve) => {
          resolveFindDue = resolve;
        })
    );
    const timers = { findDue, deleteById: vi.fn() };
    const scheduler = new RestTimerScheduler(timers, {
      sendRestOver: vi.fn(),
    });

    const firstTick = scheduler.tick();
    const secondTick = scheduler.tick();
    resolveFindDue([]);
    await Promise.all([firstTick, secondTick]);

    expect(findDue).toHaveBeenCalledOnce();
  });

  it("polls on the configured interval until stopped", async () => {
    vi.useFakeTimers();
    const { scheduler, timers } = createScheduler([]);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(timers.findDue).toHaveBeenCalledOnce();

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(timers.findDue).toHaveBeenCalledOnce();
  });
});
