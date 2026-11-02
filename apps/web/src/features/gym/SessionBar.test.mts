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
  WeightSuggestions,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import SessionView from "./SessionView.svelte";

const REST_PRESET_KEY = "gymos.restTimerSeconds";

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

  render(SessionView, {
    props: {
      session,
      plan,
      exercises: [exercise],
      weightSuggestions: {} as WeightSuggestions,
      onLogSet: onLogSet as (input: CreateWorkoutSetInput) => Promise<void>,
      onComplete: onComplete as () => Promise<void>,
    },
  });

  return { onLogSet, onComplete };
}

function bar() {
  return screen.getByRole("region", { name: "Workout controls" });
}

function timerButton() {
  return screen.getByRole("button", { name: /rest timer/i });
}

async function logSet(onLogSet: ReturnType<typeof vi.fn>) {
  const form = within(
    screen.getByRole("form", { name: "Add set for Bench Press" })
  );
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
    window.sessionStorage.clear();
    try {
      window.localStorage.clear();
    } catch {
      // localStorage is unavailable in some test environments.
    }
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
