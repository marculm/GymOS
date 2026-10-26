import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Exercise, WorkoutPlan, WorkoutSessionDetail } from "@gymos/shared";
import { SessionView } from "./SessionView.tsx";

type Props = ComponentProps<typeof SessionView>;

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
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

function renderSession(overrides: Partial<Props> = {}) {
  const onLogSet = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn().mockResolvedValue(undefined);

  render(
    <SessionView
      session={session}
      plan={plan}
      exercises={[exercise]}
      onLogSet={onLogSet}
      onComplete={onComplete}
      {...overrides}
    />
  );

  return { onLogSet, onComplete };
}

describe("SessionView", () => {
  it("renders the plan exercise and its target", () => {
    renderSession();

    expect(screen.getByRole("heading", { name: "Bench Press" })).toBeInTheDocument();
    expect(screen.getByText(/4 × 8/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80 kg/)).toBeInTheDocument();
  });

  it("logs a set with the selected exercise", async () => {
    const { onLogSet } = renderSession();

    fireEvent.change(screen.getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    fireEvent.change(screen.getByLabelText("Reps"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("RPE (optional)"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 82.5,
        reps: 6,
        rpe: 9,
      });
    });
  });

  it("finishes the workout", async () => {
    const { onComplete } = renderSession();

    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("hides logging controls for a completed session", () => {
    renderSession({
      session: { ...session, completedAt: "2026-10-26T19:00:00.000Z" },
    });

    expect(
      screen.queryByRole("button", { name: "Finish workout" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log set" })
    ).not.toBeInTheDocument();
  });
});
