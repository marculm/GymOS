import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import type {
  CreateWorkoutSetInput,
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import SessionView from "./SessionView.svelte";
import * as push from "../../push.mts";

vi.mock("../../push.mts", () => ({
  isPushSupported: vi.fn(() => true),
  isPushSubscribed: vi.fn(async () => false),
  enablePush: vi.fn(async () => true),
  disablePush: vi.fn(async () => undefined),
  syncRestTimer: vi.fn(async () => undefined),
}));

const REST_PRESET_KEY = "gymos.restTimerSeconds";
const REST_END_KEY = "gymos.restTimerEndsAt";

function presetStorage(): Storage | null {
  try {
    return window.localStorage ?? window.sessionStorage;
  } catch {
    return null;
  }
}

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 4,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
  createdAt: "2026-10-26T18:00:00.000Z",
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
};

const session: WorkoutSessionDetail = {
  id: "session-1",
  title: "Push Day",
  planId: plan.id,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

function renderSession() {
  const onLogSet = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn().mockResolvedValue(undefined);

  const view = render(SessionView, {
    props: {
      session,
      plan,
      exercises: [exercise],
      onLogSet: onLogSet as (input: CreateWorkoutSetInput) => Promise<void>,
      onDeleteSet: vi.fn().mockResolvedValue(undefined),
      onUpdateExercise: vi.fn().mockResolvedValue(undefined),
      onComplete: onComplete as () => Promise<void>,
    },
  });

  return { onLogSet, onComplete, unmount: view.unmount };
}

function bar() {
  return screen.getByRole("region", { name: "Workout controls" });
}

function timerButton() {
  return screen.getByRole("button", { name: /rest timer/i });
}

async function logSet(onLogSet: ReturnType<typeof vi.fn>) {
  await fireEvent.click(
    screen.getByRole("button", { name: "Expand Bench Press" })
  );
  const formElement = screen.getByRole("form", {
    name: "Add set for Bench Press",
  });
  // happy-dom rejects two-decimal values against step=0.01; browsers accept them.
  (formElement as HTMLFormElement).noValidate = true;
  const form = within(formElement);
  await fireEvent.input(form.getByLabelText("Weight (kg)"), {
    target: { value: "80" },
  });
  await fireEvent.input(form.getByLabelText("Reps"), {
    target: { value: "8" },
  });
  await fireEvent.click(form.getByRole("button", { name: /add set/i }));
  await waitFor(() => expect(onLogSet).toHaveBeenCalled());
}

describe("SessionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    try {
      window.localStorage.clear();
    } catch {
      // localStorage is unavailable in some test environments.
    }
    vi.mocked(push.isPushSupported).mockReturnValue(true);
    vi.mocked(push.isPushSubscribed).mockResolvedValue(false);
    vi.mocked(push.enablePush).mockResolvedValue(true);
    vi.mocked(push.disablePush).mockResolvedValue(undefined);
    vi.mocked(push.syncRestTimer).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the timer and finish action in the session bar", () => {
    renderSession();

    expect(
      within(bar()).getByRole("button", { name: "Finish workout" })
    ).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: /rest timer/i })).toHaveTextContent(
      "0:00"
    );
  });

  it("starts the countdown after a logged set", async () => {
    vi.useFakeTimers();

    const { onLogSet } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);

    expect(timerButton()).toHaveTextContent("2:00");

    await vi.advanceTimersByTimeAsync(3000);
    expect(timerButton()).toHaveTextContent("1:57");
  });

  it("changes the preset and remembers it locally", async () => {
    renderSession();

    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "3:00" }));

    expect(timerButton()).toHaveTextContent("3:00");
    expect(presetStorage()?.getItem(REST_PRESET_KEY)).toBe("180");
  });

  it("restores the stored preset", async () => {
    presetStorage()?.setItem(REST_PRESET_KEY, "150");

    renderSession();
    await fireEvent.click(timerButton());

    expect(
      within(bar()).getByRole("button", { name: "2:30" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the countdown across a remount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));

    const { onLogSet, unmount } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);

    unmount();
    vi.setSystemTime(new Date("2026-11-07T10:00:30.000Z"));
    renderSession();

    expect(timerButton()).toHaveTextContent("1:30");
  });

  it("resumes the countdown from the stored end timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));
    presetStorage()?.setItem(REST_END_KEY, String(Date.now() + 90_000));

    renderSession();
    expect(timerButton()).toHaveTextContent("1:30");

    await vi.advanceTimersByTimeAsync(3000);
    expect(timerButton()).toHaveTextContent("1:27");
  });

  it("shows zero when the stored end timestamp has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));
    presetStorage()?.setItem(REST_END_KEY, String(Date.now() - 5_000));

    renderSession();

    expect(timerButton()).toHaveTextContent("0:00");
  });

  it("clears the stored countdown when the workout finishes", async () => {
    vi.useFakeTimers();

    const { onLogSet, onComplete } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);
    expect(presetStorage()?.getItem(REST_END_KEY)).not.toBeNull();

    await fireEvent.click(
      within(bar()).getByRole("button", { name: "Finish workout" })
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(presetStorage()?.getItem(REST_END_KEY)).toBeNull();
  });

  it("clears the end timestamp when the countdown reaches zero", async () => {
    vi.useFakeTimers();

    renderSession();
    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));
    expect(presetStorage()?.getItem(REST_END_KEY)).not.toBeNull();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(timerButton()).toHaveTextContent("0:00");
    expect(presetStorage()?.getItem(REST_END_KEY)).toBeNull();
  });

  it("catches up with the stored end after the page was suspended", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));

    const { onLogSet } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);

    vi.setSystemTime(new Date("2026-11-07T10:00:30.000Z"));
    await vi.advanceTimersByTimeAsync(1000);

    expect(timerButton()).toHaveTextContent("1:29");
  });

  it("stores the end timestamp when a logged set starts the countdown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));

    const { onLogSet } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);

    expect(presetStorage()?.getItem(REST_END_KEY)).toBe(
      String(Date.now() + 120_000)
    );
  });

  it("updates the end timestamp when the preset changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));

    renderSession();
    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "3:00" }));

    expect(presetStorage()?.getItem(REST_END_KEY)).toBe(
      String(Date.now() + 180_000)
    );
  });

  it("clears the end timestamp when the timer stops", async () => {
    vi.useFakeTimers();

    renderSession();
    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));
    expect(presetStorage()?.getItem(REST_END_KEY)).not.toBeNull();

    await fireEvent.click(within(bar()).getByRole("button", { name: "Stop" }));
    expect(presetStorage()?.getItem(REST_END_KEY)).toBeNull();
  });

  it("hides the notification bell when push is unsupported", () => {
    vi.mocked(push.isPushSupported).mockReturnValue(false);

    renderSession();

    expect(
      screen.queryByRole("button", { name: "Rest notifications" })
    ).not.toBeInTheDocument();
  });

  it("asks for notification permission from the session bar", async () => {
    renderSession();
    const bell = screen.getByRole("button", { name: "Rest notifications" });
    expect(bell).toHaveAttribute("aria-pressed", "false");

    await fireEvent.click(bell);

    await waitFor(() => expect(push.enablePush).toHaveBeenCalledOnce());
    await waitFor(() => expect(bell).toHaveAttribute("aria-pressed", "true"));
  });

  it("restores the bell when notifications are already enabled", async () => {
    vi.mocked(push.isPushSubscribed).mockResolvedValue(true);

    renderSession();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Rest notifications" })
      ).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("turns notifications off from the session bar", async () => {
    vi.mocked(push.isPushSubscribed).mockResolvedValue(true);
    renderSession();
    const bell = screen.getByRole("button", { name: "Rest notifications" });
    await waitFor(() => expect(bell).toHaveAttribute("aria-pressed", "true"));

    await fireEvent.click(bell);

    await waitFor(() => expect(push.disablePush).toHaveBeenCalledOnce());
    expect(bell).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the in-app timer when notifications cannot be enabled", async () => {
    vi.mocked(push.enablePush).mockResolvedValue(false);
    renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: "Rest notifications" })
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/in-app timer/i)
    );
    expect(
      screen.getByRole("button", { name: "Rest notifications" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("registers the rest timer end with the API", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00.000Z"));

    const { onLogSet } = renderSession();
    await logSet(onLogSet);
    await vi.advanceTimersByTimeAsync(0);

    expect(push.syncRestTimer).toHaveBeenCalledWith(Date.now() + 120_000);
  });

  it("cancels the server timer when the user stops it", async () => {
    vi.useFakeTimers();

    renderSession();
    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));
    await fireEvent.click(within(bar()).getByRole("button", { name: "Stop" }));

    expect(push.syncRestTimer).toHaveBeenLastCalledWith(null);
  });

  it("does not cancel the server timer when the countdown reaches zero", async () => {
    vi.useFakeTimers();

    renderSession();
    await fireEvent.click(timerButton());
    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));

    await vi.advanceTimersByTimeAsync(120_000);

    expect(timerButton()).toHaveTextContent("0:00");
    expect(push.syncRestTimer).not.toHaveBeenCalledWith(null);
  });

  it("stops and resets the countdown", async () => {
    vi.useFakeTimers();

    renderSession();
    await fireEvent.click(timerButton());

    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));
    expect(timerButton()).toHaveTextContent("2:00");

    await fireEvent.click(within(bar()).getByRole("button", { name: "Stop" }));
    expect(timerButton()).toHaveTextContent("0:00");

    await fireEvent.click(within(bar()).getByRole("button", { name: "Reset" }));
    expect(timerButton()).toHaveTextContent("2:00");
  });
});
