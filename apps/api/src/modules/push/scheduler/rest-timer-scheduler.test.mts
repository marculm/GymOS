import { afterEach, describe, expect, it, vi } from "vitest";
import { RestTimerScheduler } from "./rest-timer-scheduler.mts";
import type { DueRestTimer } from "../repository/rest-timer-repository.mts";

function createScheduler(
  due: DueRestTimer[],
  sendRestOver = vi.fn().mockResolvedValue(undefined)
) {
  const timers = {
    findDue: vi.fn().mockResolvedValue(due),
    deleteIfUnchanged: vi.fn().mockResolvedValue(undefined),
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
    expect(timers.deleteIfUnchanged).toHaveBeenNthCalledWith(
      1,
      "timer-1",
      now
    );
    expect(timers.deleteIfUnchanged).toHaveBeenNthCalledWith(
      2,
      "timer-2",
      now
    );
  });

  it("deletes a timer even when its push fails", async () => {
    const due = [{ id: "timer-1", userId: "user-1", endAt: new Date() }];
    const sendRestOver = vi
      .fn()
      .mockRejectedValueOnce(new Error("push service unavailable"));
    const { scheduler, timers } = createScheduler(due, sendRestOver);

    await scheduler.tick();

    expect(sendRestOver).toHaveBeenCalledOnce();
    expect(timers.deleteIfUnchanged).toHaveBeenCalledExactlyOnceWith(
      "timer-1",
      due[0]?.endAt
    );
  });

  it("discards a timer that is too old to notify", async () => {
    const now = new Date("2026-11-08T10:00:00.000Z");
    const endAt = new Date("2026-11-08T09:50:00.000Z");
    const due = [{ id: "timer-1", userId: "user-1", endAt }];
    const { scheduler, timers, sendRestOver } = createScheduler(due);

    await scheduler.tick(now);

    expect(sendRestOver).not.toHaveBeenCalled();
    expect(timers.deleteIfUnchanged).toHaveBeenCalledExactlyOnceWith(
      "timer-1",
      endAt
    );
  });

  it("keeps a timer that was restarted while the push was in flight", async () => {
    const endAt = new Date("2026-11-08T10:00:00.000Z");
    const restarted = new Date("2026-11-08T10:02:00.000Z");
    let currentEndAt: Date | null = endAt;
    const timers = {
      findDue: vi
        .fn()
        .mockResolvedValue([{ id: "timer-1", userId: "user-1", endAt }]),
      deleteIfUnchanged: vi.fn(async (_id: string, snapshot: Date) => {
        if (snapshot.getTime() === currentEndAt?.getTime()) {
          currentEndAt = null;
        }
      }),
    };
    const sendRestOver = vi.fn(async () => {
      currentEndAt = restarted;
    });
    const scheduler = new RestTimerScheduler(timers, { sendRestOver });

    await scheduler.tick(endAt);

    expect(currentEndAt).toEqual(restarted);
  });

  it("does not overlap ticks while one is running", async () => {
    let resolveFindDue: (timers: DueRestTimer[]) => void = () => {};
    const findDue = vi.fn(
      () =>
        new Promise<DueRestTimer[]>((resolve) => {
          resolveFindDue = resolve;
        })
    );
    const timers = { findDue, deleteIfUnchanged: vi.fn() };
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
