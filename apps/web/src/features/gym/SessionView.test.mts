import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import SessionView from "./SessionView.svelte";

const bench: Exercise = {
  id: "ex-1",
  name: "Barbell Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const shoulder: Exercise = {
  id: "ex-2",
  name: "Overhead Shoulder Press",
  muscleGroup: "shoulders",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 40,
};

const tricep: Exercise = {
  id: "ex-3",
  name: "Tricep Rope Pushdown",
  muscleGroup: "arms",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: null,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: "Chest, shoulders, and triceps",
  createdAt: "2026-11-13T18:00:00.000Z",
  exercises: [bench, shoulder, tricep].map((exercise, position) => ({
    id: `plan-ex-${exercise.id}`,
    position,
    targetSets: exercise.defaultSets,
    targetReps: exercise.defaultReps,
    targetWeightKg: exercise.defaultWeightKg,
    notes: null,
    exercise,
  })),
};

const session: WorkoutSessionDetail = {
  id: "session-1",
  title: "Push Day",
  planId: plan.id,
  startedAt: "2026-11-13T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

function renderSession(
  overrides: Partial<{
    session: WorkoutSessionDetail;
    plan: WorkoutPlan | null;
    exercises: Exercise[];
  }> = {}
) {
  const onLogSet = vi.fn().mockResolvedValue(undefined);
  const onDeleteSet = vi.fn().mockResolvedValue(undefined);
  const onUpdateExercise = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn().mockResolvedValue(undefined);

  render(SessionView, {
    props: {
      session,
      plan,
      exercises: [bench, shoulder, tricep],
      onLogSet,
      onDeleteSet,
      onUpdateExercise,
      onComplete,
      ...overrides,
    },
  });

  return { onLogSet, onDeleteSet, onUpdateExercise, onComplete };
}

function activePage(): HTMLElement {
  const page = document.querySelector<HTMLElement>(
    '.focus-page[aria-hidden="false"]'
  );
  if (!page) throw new Error("active focus page is missing");
  return page;
}

beforeEach(() => {
  try {
    window.localStorage?.clear();
  } catch {
    // localStorage is unavailable in the test environment.
  }
});

describe("SessionView", () => {
  it("focuses the first exercise and shows its last performance", () => {
    renderSession();

    expect(
      screen.getByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Exercise 1 of 3")).toBeInTheDocument();
    expect(screen.getByText(/3 × 8 @ 80 kg/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit reps, current 8" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit weight, current 80 kg" })
    ).toBeInTheDocument();
  });

  it("logs a set with the current values and starts the rest timer", async () => {
    const { onLogSet } = renderSession();

    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => expect(onLogSet).toHaveBeenCalledOnce());
    expect(onLogSet).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: "ex-1",
        reps: 8,
        weightKg: 80,
        idempotencyKey: expect.any(String),
      })
    );
    expect(
      await screen.findByRole("button", {
        name: /Rest timer running, 2:30/,
      })
    ).toBeInTheDocument();
  });

  it("changes reps and weight with the steppers", async () => {
    renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: "Increase reps" })
    );
    expect(
      screen.getByRole("button", { name: "Edit reps, current 9" })
    ).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole("button", { name: "Increase weight" })
    );
    expect(
      screen.getByRole("button", { name: "Edit weight, current 82.5 kg" })
    ).toBeInTheDocument();
  });

  it("accepts a typed value", async () => {
    renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: "Edit reps, current 8" })
    );
    const input = document.querySelector<HTMLInputElement>(".metric-input");
    if (!input) throw new Error("metric input is missing");
    await fireEvent.input(input, { target: { value: "10" } });
    await fireEvent.blur(input);

    expect(
      screen.getByRole("button", { name: "Edit reps, current 10" })
    ).toBeInTheDocument();
  });

  it("moves to the next exercise", async () => {
    renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: /Next · Overhead Shoulder Press/ })
    );

    expect(
      await screen.findByRole("heading", { name: "Overhead Shoulder Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Exercise 2 of 3")).toBeInTheDocument();
  });

  it("moves back to the previous exercise", async () => {
    renderSession();

    expect(
      within(activePage()).getByRole("button", { name: /^Back/ })
    ).toBeDisabled();
    await fireEvent.click(
      screen.getByRole("button", { name: /Next · Overhead Shoulder Press/ })
    );
    expect(
      within(activePage()).getByRole("button", {
        name: /Back · Barbell Bench Press/,
      })
    ).toBeInTheDocument();
    await fireEvent.click(
      within(activePage()).getByRole("button", { name: /^Back/ })
    );

    expect(
      await screen.findByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Exercise 1 of 3")).toBeInTheDocument();
  });

  it("swipes between exercises", async () => {
    renderSession();

    const pager = screen.getByRole("group", { name: "Workout exercises" });
    await fireEvent.pointerDown(pager, {
      clientX: 300,
      clientY: 200,
      pointerId: 1,
      isPrimary: true,
    });
    await fireEvent.pointerUp(pager, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
      isPrimary: true,
    });

    expect(
      await screen.findByRole("heading", { name: "Overhead Shoulder Press" })
    ).toBeInTheDocument();
  });

  it("jumps to an exercise from the switcher", async () => {
    renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: "Exercises" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Exercises" });
    await fireEvent.click(
      within(dialog).getByRole("button", { name: /Tricep Rope Pushdown/ })
    );

    expect(
      await screen.findByRole("heading", { name: "Tricep Rope Pushdown" })
    ).toBeInTheDocument();
  });

  it("deletes a logged set from the inline list", async () => {
    const withSet: WorkoutSessionDetail = {
      ...session,
      sets: [
        {
          id: "set-1",
          exerciseId: bench.id,
          exerciseName: bench.name,
          setNumber: 1,
          reps: 8,
          weightKg: 80,
          createdAt: "2026-11-13T18:05:00.000Z",
        },
      ],
    };
    const { onDeleteSet } = renderSession({ session: withSet });

    await fireEvent.click(
      screen.getByRole("button", { name: /1 of 3 sets/ })
    );
    const panel = document.querySelector<HTMLElement>(".focus-set-panel");
    if (!panel) throw new Error("inline set list is missing");
    expect(within(panel).getByText("Set 1")).toBeInTheDocument();
    await fireEvent.click(
      within(panel).getByRole("button", {
        name: "Delete set 1 for Barbell Bench Press",
      })
    );
    await fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleteSet).toHaveBeenCalledWith("set-1"));
  });

  it("finishes the workout", async () => {
    const { onComplete } = renderSession();

    await fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it("adds an exercise to a free workout", async () => {
    renderSession({
      plan: null,
      session: { ...session, title: "Free workout", planId: null },
    });

    expect(
      screen.getByRole("heading", { name: "No exercises yet" })
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: "Add exercise" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Exercises" });
    await fireEvent.change(within(dialog).getByLabelText("Add exercise"), {
      target: { value: "ex-1" },
    });
    await fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
  });
});
