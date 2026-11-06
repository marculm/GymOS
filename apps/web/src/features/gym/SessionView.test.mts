import { afterEach, describe, expect, it, vi } from "vitest";
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
  WeightSuggestions,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import SessionView from "./SessionView.svelte";

type Props = {
  session: WorkoutSessionDetail;
  plan: WorkoutPlan | null;
  exercises: Exercise[];
  weightSuggestions: WeightSuggestions;
  onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
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
  createdAt: "2026-10-26T18:05:00.000Z",
};

const missingExerciseSet: LoggedSet = {
  ...cableSet,
  exerciseId: "exercise-missing",
  exerciseName: "Deleted Press",
};

const benchSet: LoggedSet = {
  id: "set-1",
  exerciseId: "exercise-1",
  exerciseName: "Bench Press",
  setNumber: 1,
  reps: 8,
  weightKg: 80,
  createdAt: "2026-10-26T18:05:00.000Z",
};

const benchSet2: LoggedSet = {
  ...benchSet,
  id: "set-2",
  setNumber: 2,
  reps: 6,
};

function loggedSets(base: LoggedSet, count: number): LoggedSet[] {
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    id: `set-${index + 1}`,
    setNumber: index + 1,
  }));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderSession(overrides: Partial<Props> = {}) {
  const onLogSet = vi.fn().mockResolvedValue(undefined);
  const onDeleteSet = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn().mockResolvedValue(undefined);

  const result = render(SessionView, {
    props: {
      session,
      plan,
      exercises: [exercise, extraExercise],
      weightSuggestions: {},
      onLogSet,
      onDeleteSet,
      onComplete,
      ...overrides,
    },
  });

  return { onLogSet, onDeleteSet, onComplete, rerender: result.rerender };
}

function cardForm(name: string) {
  const form = screen.getByRole("form", { name: `Add set for ${name}` });
  // happy-dom rejects two-decimal values against step=0.01; browsers accept them.
  (form as HTMLFormElement).noValidate = true;
  return within(form);
}

async function expand(name: string) {
  await fireEvent.click(
    screen.getByRole("button", { name: `Expand ${name}` })
  );
}

async function collapse(name: string) {
  await fireEvent.click(
    screen.getByRole("button", { name: `Collapse ${name}` })
  );
}

describe("SessionView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the plan exercise and its target", async () => {
    renderSession();

    expect(
      screen.getByRole("heading", { name: "Bench Press" })
    ).toBeInTheDocument();
    await expand("Bench Press");
    expect(screen.getByText(/4\s*×\s*8/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80 kg/)).toBeInTheDocument();
    expect(
      cardForm("Bench Press").getByRole("button", {
        name: "Add set for Bench Press",
      })
    ).toBeInTheDocument();
  });

  it("starts with every card collapsed", () => {
    renderSession({
      plan: twoExercisePlan,
      session: { ...session, sets: loggedSets(benchSet, 4) },
    });

    expect(screen.queryAllByRole("form")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Expand Bench Press" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Expand Cable Fly" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/sets logged/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\s*×\s*8/)).not.toBeInTheDocument();
  });

  it("toggles a card by its name without a show/hide button", async () => {
    renderSession();

    expect(
      screen.queryByRole("button", { name: /^(Show|Hide)$/ })
    ).not.toBeInTheDocument();
    await expand("Bench Press");
    expect(
      screen.getByRole("button", { name: "Collapse Bench Press" })
    ).toHaveAttribute("aria-expanded", "true");
    await collapse("Bench Press");
    expect(
      screen.getByRole("button", { name: "Expand Bench Press" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("logs a set from the exercise card", async () => {
    const { onLogSet } = renderSession();
    await expand("Bench Press");

    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: /add set/i })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 82.5,
        reps: 6,
      });
    });
  });

  it("logs each card's set for that card's exercise", async () => {
    const { onLogSet } = renderSession({ plan: twoExercisePlan });
    await expand("Cable Fly");

    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Weight (kg)"), {
      target: { value: "15" },
    });
    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Reps"), {
      target: { value: "12" },
    });
    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: /add set/i })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-2",
        weightKg: 15,
        reps: 12,
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
    await expand("Bench Press");
    await expand("Cable Fly");

    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "80" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "8" },
    });
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: /add set/i })
    );
    await waitFor(() =>
      expect(
        cardForm("Bench Press").getByLabelText("Weight (kg)")
      ).toBeDisabled()
    );

    const otherForm = cardForm("Cable Fly");
    expect(otherForm.getByLabelText("Weight (kg)")).toBeDisabled();
    expect(otherForm.getByLabelText("Reps")).toBeDisabled();
    expect(otherForm.getByRole("button", { name: /add set/i })).toBeDisabled();

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
    await expand("Bench Press");

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
    await expand("Bench Press");
    await expand("Cable Fly");

    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "82.5" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "6" },
    });
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: /add set/i })
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

  it("caps weight and reps at the API limits", async () => {
    renderSession();
    await expand("Bench Press");

    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveAttribute(
      "max",
      String(MAX_SET_WEIGHT_KG)
    );
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveAttribute(
      "max",
      String(MAX_SET_REPS)
    );
  });

  it("has no RPE field", async () => {
    renderSession();
    await expand("Bench Press");

    expect(
      cardForm("Bench Press").queryByLabelText("RPE (optional)")
    ).not.toBeInTheDocument();
  });

  it("shows the suggestion as a placeholder without prefilling inputs", async () => {
    renderSession({
      plan: twoExercisePlan,
      weightSuggestions: { "exercise-1": 82.5 },
    });
    await expand("Bench Press");
    await expand("Cable Fly");

    const weight = cardForm("Bench Press").getByLabelText("Weight (kg)");
    expect(weight).toHaveAttribute("placeholder", "82.5");
    expect(weight).toHaveValue(null);
    expect(cardForm("Bench Press").getByLabelText("Reps")).toHaveValue(null);
  });

  it("falls back to the exercise default weight as the placeholder", async () => {
    renderSession({ plan: twoExercisePlan });
    await expand("Bench Press");
    await expand("Cable Fly");

    expect(cardForm("Bench Press").getByLabelText("Weight (kg)")).toHaveAttribute(
      "placeholder",
      "60"
    );
    expect(cardForm("Cable Fly").getByLabelText("Weight (kg)")).toHaveAttribute(
      "placeholder",
      "15"
    );
  });

  it("has no weight placeholder without history or a default", async () => {
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
    await expand("Bench Press");

    expect(
      cardForm("Bench Press").getByLabelText("Weight (kg)").getAttribute(
        "placeholder"
      )
    ).toBeNull();
  });

  it("submits typed values instead of the placeholder", async () => {
    const { onLogSet } = renderSession({
      weightSuggestions: { "exercise-1": 82.5 },
    });
    await expand("Bench Press");
    const form = cardForm("Bench Press");

    await fireEvent.click(form.getByRole("button", { name: /add set/i }));
    await fireEvent.input(form.getByLabelText("Weight (kg)"), {
      target: { value: "65" },
    });
    await fireEvent.click(form.getByRole("button", { name: /add set/i }));
    expect(onLogSet).not.toHaveBeenCalled();

    await fireEvent.input(form.getByLabelText("Reps"), {
      target: { value: "5" },
    });
    await fireEvent.click(form.getByRole("button", { name: /add set/i }));

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-1",
        weightKg: 65,
        reps: 5,
      });
    });
  });

  it("deletes a set after confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { onDeleteSet } = renderSession({
      session: { ...session, sets: [benchSet, benchSet2] },
    });
    await expand("Bench Press");

    await fireEvent.click(
      screen.getByRole("button", { name: "Delete set 2 for Bench Press" })
    );

    await waitFor(() => {
      expect(onDeleteSet).toHaveBeenCalledWith("set-2");
    });
  });

  it("keeps the set when the confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const { onDeleteSet } = renderSession({
      session: { ...session, sets: [benchSet] },
    });
    await expand("Bench Press");

    await fireEvent.click(
      screen.getByRole("button", { name: "Delete set 1 for Bench Press" })
    );

    expect(onDeleteSet).not.toHaveBeenCalled();
  });

  it("shows a failed delete in the session bar", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderSession({
      session: { ...session, sets: [benchSet] },
      onDeleteSet: vi.fn().mockRejectedValue(new Error("Could not delete")),
    });
    await expand("Bench Press");

    await fireEvent.click(
      screen.getByRole("button", { name: "Delete set 1 for Bench Press" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete"
    );
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });

  it("offers no delete action for a completed session", async () => {
    renderSession({
      session: {
        ...session,
        completedAt: "2026-10-26T19:00:00.000Z",
        sets: [benchSet],
      },
    });
    await expand("Bench Press");

    expect(
      screen.queryByRole("button", { name: /delete set/i })
    ).not.toBeInTheDocument();
  });

  it("auto-collapses a planned card when its target sets are reached", async () => {
    const { rerender } = renderSession({
      session: { ...session, sets: loggedSets(benchSet, 3) },
    });
    await expand("Bench Press");

    await rerender({ session: { ...session, sets: loggedSets(benchSet, 4) } });

    expect(
      screen.queryByRole("form", { name: "Add set for Bench Press" })
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Expand Bench Press" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "sets-exercise-1");
    expect(document.getElementById("sets-exercise-1")).toBeInTheDocument();
    expect(toggle.closest("section")).toHaveClass("exercise-done");
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText(/sets logged/)).not.toBeInTheDocument();
  });

  it("keeps a manually expanded card open while it is below its target", async () => {
    const { rerender } = renderSession({
      session: { ...session, sets: loggedSets(benchSet, 1) },
    });
    await expand("Bench Press");

    await rerender({ session: { ...session, sets: loggedSets(benchSet, 3) } });

    expect(
      screen.getByRole("form", { name: "Add set for Bench Press" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Bench Press" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("expands a done card manually and keeps the done state", async () => {
    renderSession({
      session: { ...session, sets: loggedSets(benchSet, 4) },
    });

    await expand("Bench Press");

    expect(
      screen.getByRole("form", { name: "Add set for Bench Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Bench Press" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("does not re-collapse a manually expanded card after extra sets", async () => {
    const { rerender } = renderSession({
      session: { ...session, sets: loggedSets(benchSet, 4) },
    });

    await expand("Bench Press");
    await rerender({ session: { ...session, sets: loggedSets(benchSet, 5) } });

    expect(
      screen.getByRole("form", { name: "Add set for Bench Press" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Bench Press" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("starts a free exercise card collapsed and toggles it manually", async () => {
    renderSession({
      session: { ...freeSession, sets: [cableSet] },
      plan: null,
    });

    expect(
      screen.queryByRole("form", { name: "Add set for Cable Fly" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("1 set logged")).not.toBeInTheDocument();

    await expand("Cable Fly");

    expect(
      screen.getByRole("form", { name: "Add set for Cable Fly" })
    ).toBeInTheDocument();

    await collapse("Cable Fly");

    expect(
      screen.queryByRole("form", { name: "Add set for Cable Fly" })
    ).not.toBeInTheDocument();
  });

  it("never auto-collapses a free exercise without a target", async () => {
    const { rerender } = renderSession({
      session: { ...freeSession, sets: loggedSets(cableSet, 8) },
      plan: null,
    });
    await expand("Cable Fly");

    await rerender({
      session: { ...freeSession, sets: loggedSets(cableSet, 9) },
      plan: null,
    });

    expect(
      screen.getByRole("form", { name: "Add set for Cable Fly" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Cable Fly" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("displays weights with up to two decimals", async () => {
    renderSession({
      session: {
        ...session,
        sets: [
          { ...benchSet, weightKg: 22.25 },
          { ...benchSet2, weightKg: 22.5 },
        ],
      },
      plan: {
        ...plan,
        exercises: [{ ...planExercise, targetWeightKg: 22.25 }],
      },
    });
    await expand("Bench Press");

    expect(screen.getByText("8 × 22.25 kg")).toBeInTheDocument();
    expect(screen.getByText("6 × 22.5 kg")).toBeInTheDocument();
    expect(screen.getByText(/@ 22.25 kg/)).toBeInTheDocument();
    expect(screen.queryByText(/22\.50/)).not.toBeInTheDocument();
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

  it("returns focus to finish after a failed completion", async () => {
    renderSession({
      onComplete: vi.fn().mockRejectedValue(new Error("Could not finish")),
    });

    const finish = screen.getByRole("button", { name: "Finish workout" });
    finish.focus();
    await fireEvent.click(finish);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not finish"
    );
    await waitFor(() => expect(finish).toHaveFocus());
  });

  it("hides logging controls for a completed session", () => {
    renderSession({
      session: { ...session, completedAt: "2026-10-26T19:00:00.000Z" },
    });

    expect(
      screen.queryByRole("button", { name: "Finish workout" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add set/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("uses the set's exercise name when the exercise is not in the loaded list", async () => {
    renderSession({
      session: { ...session, sets: [missingExerciseSet] },
    });
    await expand("Deleted Press");

    expect(
      screen.getByRole("heading", { name: "Deleted Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add set for Deleted Press" })
    ).not.toBeInTheDocument();
  });

  it("shows sets for exercises outside the plan", async () => {
    renderSession({
      session: { ...session, sets: [cableSet] },
    });
    await expand("Cable Fly");

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
    const { onLogSet } = renderSession({
      session: freeSession,
      plan: null,
      weightSuggestions: { "exercise-2": 17.5 },
    });

    await fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: extraExercise.id },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Add exercise" })
    );

    expect(
      screen.getByRole("heading", { name: "Cable Fly" })
    ).toBeInTheDocument();
    await expand("Cable Fly");
    expect(
      screen.getByRole("form", { name: "Add set for Cable Fly" })
    ).toBeInTheDocument();
    expect(cardForm("Cable Fly").getByLabelText("Weight (kg)")).toHaveAttribute(
      "placeholder",
      "17.5"
    );

    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Weight (kg)"), {
      target: { value: "20" },
    });
    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Reps"), {
      target: { value: "10" },
    });
    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: /add set/i })
    );

    await waitFor(() => {
      expect(onLogSet).toHaveBeenCalledWith({
        exerciseId: "exercise-2",
        weightKg: 20,
        reps: 10,
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
    await expand("Cable Fly");
    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Weight (kg)"), {
      target: { value: "20" },
    });
    await fireEvent.input(cardForm("Cable Fly").getByLabelText("Reps"), {
      target: { value: "10" },
    });
    await fireEvent.click(
      cardForm("Cable Fly").getByRole("button", { name: /add set/i })
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
    await expand("Bench Press");
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Weight (kg)"), {
      target: { value: "80" },
    });
    await fireEvent.input(cardForm("Bench Press").getByLabelText("Reps"), {
      target: { value: "8" },
    });
    await fireEvent.click(
      cardForm("Bench Press").getByRole("button", { name: /add set/i })
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Exercise")).toBeDisabled()
    );
    expect(
      screen.getByRole("button", { name: "Add exercise" })
    ).toBeDisabled();

    request.resolve();
  });

  it("shows a read-only card for an unregistered free-session exercise", async () => {
    renderSession({
      session: { ...freeSession, sets: [missingExerciseSet] },
      plan: null,
    });
    await expand("Deleted Press");

    expect(
      screen.getByRole("heading", { name: "Deleted Press" })
    ).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Add set for Deleted Press" })
    ).not.toBeInTheDocument();
  });

  it("hides adding and logging controls for a completed free session", async () => {
    renderSession({
      session: {
        ...freeSession,
        completedAt: "2026-10-26T19:00:00.000Z",
        sets: [cableSet],
      },
      plan: null,
    });
    await expand("Cable Fly");

    expect(
      screen.queryByRole("button", { name: "Add exercise" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add set/i })
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
