import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
import type {
  CreateWorkoutSetInput,
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import SessionView from "./SessionView.svelte";

type Props = {
  session: WorkoutSessionDetail;
  plan: WorkoutPlan | null;
  exercises: Exercise[];
  onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
  onComplete: () => Promise<void>;
};

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 4,
  defaultReps: 10,
  defaultWeightKg: 60,
};

const extraExercise: Exercise = {
  id: "exercise-2",
  name: "Cable Fly",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 12,
  defaultWeightKg: 15,
};

const bodyweightExercise: Exercise = {
  ...exercise,
  defaultWeightKg: null,
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderSession(overrides: Partial<Props> = {}) {
  const onLogSet = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn().mockResolvedValue(undefined);

  render(SessionView, {
    props: {
      session,
      plan,
      exercises: [exercise, extraExercise],
      onLogSet,
      onComplete,
      ...overrides,
    },
  });

  return { onLogSet, onComplete };
}

describe("SessionView", () => {
  it("renders the plan exercise and its target", () => {
    renderSession();

    expect(screen.getByRole("heading", { name: "Bench Press" })).toBeInTheDocument();
    expect(screen.getByText(/4\s*×\s*8/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80 kg/)).toBeInTheDocument();
  });

  it("logs a set with the selected exercise", async () => {
    const { onLogSet } = renderSession();

    await fireEvent.input(screen.getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.input(screen.getByLabelText("RPE (optional)"), {
      target: { value: "9" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 82.5,
        reps: 6,
        rpe: 9,
      });
    });
  });

  it("disables the set form while a set is being logged", async () => {
    const request = deferred();
    renderSession({ onLogSet: vi.fn().mockReturnValue(request.promise) });

    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Weight (kg)")).toBeDisabled()
    );

    expect(screen.getByLabelText("Exercise")).toBeDisabled();
    expect(screen.getByLabelText("Reps")).toBeDisabled();
    expect(screen.getByLabelText("RPE (optional)")).toBeDisabled();

    request.resolve();
    await waitFor(() =>
      expect(screen.getByLabelText("Weight (kg)")).not.toBeDisabled()
    );
  });

  it("disables the set form while the workout is being finished", async () => {
    const request = deferred();
    renderSession({ onComplete: vi.fn().mockReturnValue(request.promise) });

    await fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Weight (kg)")).toBeDisabled()
    );

    request.resolve();
    await waitFor(() =>
      expect(screen.getByLabelText("Weight (kg)")).not.toBeDisabled()
    );
  });

  it("keeps typed values when logging a set fails", async () => {
    renderSession({
      onLogSet: vi.fn().mockRejectedValue(new Error("Network down")),
    });

    await fireEvent.input(screen.getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() =>
      expect(screen.getByText("Network down")).toBeInTheDocument()
    );
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue(82.5);
    expect(screen.getByLabelText("Reps")).toHaveValue(6);
  });

  it("caps weight and reps at the API limits", () => {
    renderSession();

    expect(screen.getByLabelText("Weight (kg)")).toHaveAttribute(
      "max",
      String(MAX_SET_WEIGHT_KG)
    );
    expect(screen.getByLabelText("Reps")).toHaveAttribute(
      "max",
      String(MAX_SET_REPS)
    );
  });

  it("omits RPE when the optional field is cleared", async () => {
    const { onLogSet } = renderSession();
    const rpeInput = screen.getByLabelText("RPE (optional)");

    await fireEvent.input(rpeInput, { target: { value: "8" } });
    await fireEvent.input(rpeInput, { target: { value: "" } });
    await fireEvent.input(screen.getByLabelText("Weight (kg)"), {
      target: { value: "80" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "8" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 80,
        reps: 8,
        rpe: undefined,
      });
    });
  });

  it("prefills logging from the exercise defaults", async () => {
    const { onLogSet } = renderSession();

    expect(screen.getByLabelText("Weight (kg)")).toHaveValue(60);
    expect(screen.getByLabelText("Reps")).toHaveValue(10);

    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 60,
        reps: 10,
        rpe: undefined,
      });
    });
  });

  it("does not borrow another exercise's default weight", () => {
    renderSession({
      plan: {
        ...plan,
        exercises: [
          {
            id: "plan-exercise-1",
            position: 0,
            targetSets: 4,
            targetReps: 8,
            targetWeightKg: 80,
            notes: null,
            exercise: bodyweightExercise,
          },
        ],
      },
    });

    expect(screen.getByLabelText("Weight (kg)")).toHaveValue(null);
    expect(screen.getByLabelText("Reps")).toHaveValue(10);
  });

  it("disables logging when there are no exercises", () => {
    renderSession({ plan: null, exercises: [] });

    expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
  });

  it("finishes the workout", async () => {
    const { onComplete } = renderSession();

    await fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));

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

  it("uses the set's exercise name when the exercise is not in the loaded list", () => {
    renderSession({
      session: {
        ...session,
        sets: [
          {
            id: "set-1",
            exerciseId: "exercise-missing",
            exerciseName: "Deleted Press",
            setNumber: 1,
            reps: 12,
            weightKg: 15,
            rpe: null,
            createdAt: "2026-10-26T18:05:00.000Z",
          },
        ],
      },
    });

    expect(
      screen.getByRole("heading", { name: "Deleted Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });

  it("shows sets for exercises outside the plan", () => {
    renderSession({
      session: {
        ...session,
        sets: [
          {
            id: "set-1",
            exerciseId: "exercise-2",
            exerciseName: "Cable Fly",
            setNumber: 1,
            reps: 12,
            weightKg: 15,
            rpe: null,
            createdAt: "2026-10-26T18:05:00.000Z",
          },
        ],
      },
    });

    expect(screen.getByRole("heading", { name: "Cable Fly" })).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });
});
