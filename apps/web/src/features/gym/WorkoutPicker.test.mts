import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import type { Exercise, WorkoutPlan } from "@gymos/shared";
import WorkoutPicker from "./WorkoutPicker.svelte";

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

const extraPlan: WorkoutPlan = {
  ...plan,
  id: "plan-2",
  name: "Pull Day",
  exercises: [],
};

function renderPicker(
  props: Partial<{
    plans: WorkoutPlan[];
    pending: boolean;
    error: string | null;
  }> = {}
) {
  const onStart = vi.fn();
  const onClose = vi.fn();
  render(WorkoutPicker, {
    props: {
      plans: [plan, extraPlan],
      onStart,
      onClose,
      ...props,
    },
  });
  return { onStart, onClose };
}

describe("WorkoutPicker", () => {
  it("lists every plan and starts the chosen one", async () => {
    const { onStart } = renderPicker();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose a workout" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /push day/i })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /pull day/i }));

    expect(onStart).toHaveBeenCalledWith({ planId: extraPlan.id });
  });

  it("starts a free workout", async () => {
    const { onStart } = renderPicker();

    await fireEvent.click(
      screen.getByRole("button", { name: /free workout/i })
    );

    expect(onStart).toHaveBeenCalledWith({});
  });

  it("disables choices while starting", () => {
    renderPicker({ pending: true });

    expect(screen.getByRole("button", { name: /push day/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /free workout/i })
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Starting");
  });

  it("shows a start error", () => {
    renderPicker({ error: "Session could not start" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session could not start"
    );
  });

  it("cancels with the button and with Escape", async () => {
    const { onClose, ...rest } = renderPicker();
    void rest;

    await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true })
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
