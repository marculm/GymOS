import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
import type {
  CreateWorkoutSetInput,
  Exercise,
  LoggedSet,
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

const planExercise = {
  id: "plan-exercise-1",
  position: 0,
  targetSets: 4,
  targetReps: 8,
  targetWeightKg: 80,
  notes: null,
  exercise,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
  createdAt: "2026-10-26T18:00:00.000Z",
  exercises: [planExercise],
};

const twoExercisePlan: WorkoutPlan = {
  ...plan,
  exercises: [
    planExercise,
    {
      id: "plan-exercise-2",
      position: 1,
      targetSets: 3,
      targetReps: 12,
      targetWeightKg: 15,
      notes: null,
      exercise: extraExercise,
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

const freeSession: WorkoutSessionDetail = {
  ...session,
  title: "Free workout",
  planId: null,
};

const cableSet: LoggedSet = {
  id: "set-1",
  exerciseId: "exercise-2",
  exerciseName: "Cable Fly",
  setNumber: 1,
  reps: 12,
  weightKg: 15,
  rpe: null,
  createdAt: "2026-10-26T18:05:00.000Z",
};

const missingExerciseSet: LoggedSet = {
  ...cableSet,
  exerciseId: "exercise-missing",
  exerciseName: "Deleted Press",
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

  const result = render(SessionView, {
    props: {
      session,
      plan,
      exercises: [exercise, extraExercise],
      onLogSet,
      onComplete,
      ...overrides,
    },
  });

  return { onLogSet, onComplete, rerender: result.rerender };
}

function cardForm(name: string) {
  return within(screen.getByRole("form", { name: `Add set for ${name}` }));
}

describe("SessionView", () => {
  it("renders the plan exercise and its target", () => {
    renderSession();

    expect(
      screen.getByRole("heading", { name: "Bench Press" })
    ).toBeInTheDocument();
    expect(screen.getByText(/4\s*×\s*8/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80 kg/)).toBeInTheDocument();
  });

  it("logs a set from the exercise card", async () => {
    const { onLogSet } = renderSession();

    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.input(
      cardForm("Bench Press").getByLabelText("RPE (optional)"),
      { target: { value: "9" } }
    );
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: "Add set" })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 82.5,
        reps: 6,
        rpe: 9,
      });
    });
  });

  it("logs each card's set for that card's exercise", async () => {
    const { onLogSet } = renderSession({ plan: twoExercisePlan });

    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: "Add set" })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-2",
        weightKg: 15,
        reps: 12,
        rpe: undefined,
      });
    });
  });

  it("has no global set form", () => {
    renderSession();

    expect(
      screen.queryByRole("heading", { name: "Log a set" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Exercise")).not.toBeInTheDocument();
  });

  it("disables every set form while a set is being logged", async () => {
    const request = deferred();
    renderSession({
      plan: twoExercisePlan,
      onLogSet: vi.fn().mockReturnValue(request.promise),
    });

    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: "Add set" })
    );
    await waitFor(() =>
      expect(
        cardForm("Bench Press").getByLabelText("Weight (kg)")
      ).toBeDisabled()
    );

    const otherForm = cardForm("Cable Fly");
    expect(otherForm.getByLabelText("Weight (kg)")).toBeDisabled();
    expect(otherForm.getByLabelText("Reps")).toBeDisabled();
    expect(otherForm.getByLabelText("RPE (optional)")).toBeDisabled();
    expect(otherForm.getByRole("button", { name: "Add set" })).toBeDisabled();

    request.resolve();
    await waitFor(() =>
      expect(
        cardForm("Bench Press").getByLabelText("Weight (kg)")
      ).not.toBeDisabled()
    );
  });

  it("disables the set forms while the workout is being finished", async () => {
    const request = deferred();
    renderSession({ onComplete: vi.fn().mockReturnValue(request.promise) });

    await fireEvent.click(
      screen.getByRole("button", { name: "Finish workout" })
    );
    await waitFor(() =>
      expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toBeDisabled()
    );

    request.resolve();
    await waitFor(() =>
      expect(
        cardForm("Bench Press").getByLabelText("Weight (kg)")
      ).not.toBeDisabled()
    );
  });

  it("shows a failed log in the card that failed and keeps its values", async () => {
    renderSession({
      plan: twoExercisePlan,
      onLogSet: vi.fn().mockRejectedValue(new Error("Network down")),
    });

    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: "Add set" })
    );

    await waitFor(() =>
      expect(cardForm("Bench Press").getByRole("alert")).toHaveTextContent(
        "Network down"
      )
    );
    expect(cardForm("Cable Fly").queryByRole("alert")).not.toBeInTheDocument();
    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveValue(
      82.5
    );
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveValue(6);
    expect(
      cardForm("Bench Press").getByLabelText("Weight (kg)")
    ).not.toBeDisabled();
  });

  it("caps weight and reps at the API limits", () => {
    renderSession();

    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveAttribute(
      "max",
      String(MAX_SET_WEIGHT_KG)
    );
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveAttribute(
      "max",
      String(MAX_SET_REPS)
    );
  });

  it("omits RPE when the optional field is cleared", async () => {
    const { onLogSet } = renderSession();

    await fireEvent.input(
      cardForm("Bench Press").getByLabelText("RPE (optional)"),
      { target: { value: "8" } }
    );
    await fireEvent.input(
      cardForm("Bench Press").getByLabelText("RPE (optional)"),
      { target: { value: "" } }
    );
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: "Add set" })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 60,
        reps: 10,
        rpe: undefined,
      });
    });
  });

  it("prefills each card from its exercise defaults", () => {
    renderSession({ plan: twoExercisePlan });

    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveValue(60);
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveValue(10);
    expect(cardForm("Cable Fly").getByLabelText("Weight (kg)")).toHaveValue(15);
    expect(cardForm("Cable Fly").getByLabelText("Reps")).toHaveValue(12);
  });

  it("does not borrow another exercise's default weight", () => {
    renderSession({
      plan: {
        ...plan,
        exercises: [
          {
            ...planExercise,
            exercise: bodyweightExercise,
          },
        ],
      },
    });

    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveValue(
      null
    );
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveValue(10);
  });

  it("finishes the workout", async () => {
    const { onComplete } = renderSession();

    await fireEvent.click(
      screen.getByRole("button", { name: "Finish workout" })
    );

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
      screen.queryByRole("button", { name: "Add set" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("uses the set's exercise name when the exercise is not in the loaded list", () => {
    renderSession({
      session: { ...session, sets: [missingExerciseSet] },
    });

    expect(
      screen.getByRole("heading", { name: "Deleted Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add set for Deleted Press" })
    ).not.toBeInTheDocument();
  });

  it("shows sets for exercises outside the plan", () => {
    renderSession({
      session: { ...session, sets: [cableSet] },
    });

    expect(
      screen.getByRole("heading", { name: "Cable Fly" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add set for Cable Fly" })
    ).not.toBeInTheDocument();
  });

  it("starts a free session with an empty state and an add exercise control", () => {
    renderSession({ session: freeSession, plan: null });

    expect(screen.getByText("No sets logged yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Exercise")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add exercise" })
    ).toBeDisabled();
  });

  it("adds an exercise card to a free session and logs a set", async () => {
    const { onLogSet } = renderSession({ session: freeSession, plan: null });

    await fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: extraExercise.id },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Add exercise" })
    );

    expect(
      screen.getByRole("heading", { name: "Cable Fly" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Add set for Cable Fly" })
    ).toBeInTheDocument();

    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: "Add set" })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-2",
        weightKg: 15,
        reps: 12,
        rpe: undefined,
      });
    });
  });

  it("keeps one card and clears the form after a free-session set is logged", async () => {
    const { rerender } = renderSession({ session: freeSession, plan: null });

    await fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: extraExercise.id },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Add exercise" })
    );
    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: "Add set" })
    );

    await waitFor(() =>
      expect(cardForm("Cable Fly").getByLabelText("Weight (kg)")).toHaveValue(
        null
      )
    );

    await rerender({ session: { ...freeSession, sets: [cableSet] } });

    expect(
      screen.getAllByRole("form", { name: "Add set for Cable Fly" })
    ).toHaveLength(1);
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });

  it("does not offer an exercise that already has a card", () => {
    renderSession({
      session: { ...freeSession, sets: [cableSet] },
      plan: null,
    });

    const select = screen.getByLabelText("Exercise");
    expect(
      within(select).queryByRole("option", { name: "Cable Fly" })
    ).not.toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Bench Press" })
    ).toBeInTheDocument();
  });

  it("disables the add exercise control while a set is being logged", async () => {
    const request = deferred();
    renderSession({
      session: freeSession,
      plan: null,
      onLogSet: vi.fn().mockReturnValue(request.promise),
    });

    await fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: exercise.id },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Add exercise" })
    );
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: "Add set" })
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Exercise")).toBeDisabled()
    );
    expect(
      screen.getByRole("button", { name: "Add exercise" })
    ).toBeDisabled();

    request.resolve();
  });

  it("shows a read-only card for an unregistered free-session exercise", () => {
    renderSession({
      session: { ...freeSession, sets: [missingExerciseSet] },
      plan: null,
    });

    expect(
      screen.getByRole("heading", { name: "Deleted Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add set for Deleted Press" })
    ).not.toBeInTheDocument();
  });

  it("hides adding and logging controls for a completed free session", () => {
    renderSession({
      session: {
        ...freeSession,
        completedAt: "2026-10-26T19:00:00.000Z",
        sets: [cableSet],
      },
      plan: null,
    });

    expect(
      screen.queryByRole("button", { name: "Add exercise" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add set" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Exercise")).not.toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });

  it("disables adding exercises when none are available", () => {
    renderSession({ session: freeSession, plan: null, exercises: [] });

    expect(
      screen.getByRole("button", { name: "Add exercise" })
    ).toBeDisabled();
    expect(
      screen.getByText("No exercises available. Add one in the exercise register.")
    ).toBeInTheDocument();
  });
});
