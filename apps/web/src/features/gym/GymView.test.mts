import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutRotation,
  WorkoutSessionDetail,
} from "@gymos/shared";
import { ApiError } from "../../api/client.mts";
import GymView from "./GymView.svelte";
import {
  addSet,
  completeSession,
  createExercise,
  createPlan,
  deleteExercise,
  deletePlan,
  getActiveSession,
  getRotation,
  listAllExercises,
  listAllPlans,
  setRotation,
  startSession,
  updateExercise,
  updatePlan,
} from "../../api/gym.mts";

vi.mock("../../api/gym.mts", () => ({
  listAllExercises: vi.fn(),
  listAllPlans: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  getRotation: vi.fn(),
  setRotation: vi.fn(),
  startSession: vi.fn(),
  getActiveSession: vi.fn(),
  addSet: vi.fn(),
  completeSession: vi.fn(),
}));

function page<T>(content: T[]) {
  return {
    content,
    page: {
      size: 20,
      number: 0,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
    },
  };
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

const extraExercise: Exercise = {
  id: "exercise-2",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
  defaultSets: 5,
  defaultReps: 5,
  defaultWeightKg: 100,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: "Chest and shoulders",
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

const session: WorkoutSessionDetail = {
  id: "session-1",
  title: "Push Day",
  planId: plan.id,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

async function startScreenReady() {
  return screen.findByRole("button", { name: /other workout/i });
}

async function openManagement() {
  await fireEvent.click(
    await screen.findByRole("button", { name: /manage training plan/i })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listAllExercises).mockResolvedValue([exercise]);
  vi.mocked(listAllPlans).mockResolvedValue([plan]);
  vi.mocked(getActiveSession).mockResolvedValue(null);
  vi.mocked(startSession).mockResolvedValue(session);
  vi.mocked(createPlan).mockResolvedValue(plan);
  vi.mocked(updatePlan).mockResolvedValue(plan);
  vi.mocked(deletePlan).mockResolvedValue(undefined);
  vi.mocked(getRotation).mockResolvedValue({ plans: [], nextPlanId: null });
  vi.mocked(setRotation).mockImplementation(async ({ planIds }) => {
    const byId = new Map([plan, extraPlan].map((entry) => [entry.id, entry]));
    const plans = planIds.flatMap((id) => byId.get(id) ?? []);
    return { plans, nextPlanId: plans[0]?.id ?? null };
  });
  vi.mocked(createExercise).mockResolvedValue(exercise);
  vi.mocked(updateExercise).mockResolvedValue(exercise);
  vi.mocked(deleteExercise).mockResolvedValue(exercise);
  vi.mocked(addSet).mockResolvedValue({
    id: "set-1",
    exerciseId: "exercise-1",
    exerciseName: "Bench Press",
    setNumber: 1,
    reps: 8,
    weightKg: 80,
    rpe: null,
    createdAt: "2026-10-26T18:05:00.000Z",
  });
  vi.mocked(completeSession).mockResolvedValue({
    ...session,
    completedAt: "2026-10-26T19:00:00.000Z",
  });
});

describe("GymView", () => {
  it("leads with the next rotation workout", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });

    render(GymView);

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(screen.getByText("Chest and shoulders")).toBeInTheDocument();
    expect(screen.getByText(/1\s+exercise/)).toBeInTheDocument();
    expect(screen.getByText("4 × 8 @ 80 kg")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start workout" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /other workout/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Recent workouts")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Training rotation" })
    ).not.toBeInTheDocument();
  });

  it("starts the suggested workout", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });

    render(GymView);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Start workout" })
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({ planId: "plan-1" });
    });
    expect(
      await screen.findByRole("button", { name: /finish workout/i })
    ).toBeInTheDocument();
  });

  it("starts a suggestion that is not the first rotation plan", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan, extraPlan],
      nextPlanId: extraPlan.id,
    });

    render(GymView);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Start workout" })
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({ planId: extraPlan.id });
    });
  });

  it("opens the alternate workout picker and starts a free workout", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });

    render(GymView);

    await fireEvent.click(await startScreenReady());
    expect(
      await screen.findByRole("heading", { name: "Choose a workout" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start workout" })
    ).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole("button", { name: /free workout/i })
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({});
    });
  });

  it("starts a non-rotation plan from the picker", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });
    vi.mocked(listAllPlans).mockResolvedValueOnce([plan, extraPlan]);

    render(GymView);

    await fireEvent.click(await startScreenReady());
    await fireEvent.click(
      await screen.findByRole("button", { name: /pull day/i })
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({ planId: extraPlan.id });
    });
  });

  it("shows a start error inside the picker", async () => {
    vi.mocked(startSession).mockRejectedValueOnce(new Error("still blocked"));

    render(GymView);

    await fireEvent.click(await startScreenReady());
    await fireEvent.click(
      await screen.findByRole("button", { name: /free workout/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("still blocked");
  });

  it("opens management from the empty state", async () => {
    render(GymView);

    expect(
      await screen.findByRole("heading", { name: "No workout scheduled" })
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: /set up training plan/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Training rotation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "My training plan" })
    ).toHaveFocus();
  });

  it("keeps management hidden until requested", async () => {
    render(GymView);

    await startScreenReady();
    expect(
      screen.queryByRole("heading", { name: "Push Day" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage training plan/i })
    ).toHaveAttribute("aria-expanded", "false");

    await openManagement();
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide training plan/i })
    ).toHaveAttribute("aria-expanded", "true");

    await fireEvent.click(
      screen.getByRole("button", { name: /hide training plan/i })
    );
    expect(
      screen.queryByRole("heading", { name: "Push Day" })
    ).not.toBeInTheDocument();
  });

  it("creates a plan from the form", async () => {
    vi.mocked(createPlan).mockResolvedValueOnce({
      ...plan,
      id: "plan-2",
      name: "Leg Day",
    });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Leg Day" },
    });
    await fireEvent.input(screen.getByLabelText("Sets"), {
      target: { value: "5" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "5" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => {
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Leg Day",
          exercises: [expect.objectContaining({ targetSets: 5, targetReps: 5 })],
        })
      );
    });
  });

  it("edits a plan from the plan list", async () => {
    vi.mocked(updatePlan).mockResolvedValueOnce({ ...plan, name: "Push Day A" });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /edit push day/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Edit training plan" })
    ).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveValue("Push Day");

    await fireEvent.input(nameInput, { target: { value: "Push Day A" } });
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => {
      expect(updatePlan).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({ name: "Push Day A" })
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Push Day A" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("edits a plan whose exercises are no longer in the register", async () => {
    vi.mocked(listAllExercises).mockResolvedValueOnce([]);

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /edit push day/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Edit training plan" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Bench Press" })
    ).toBeInTheDocument();
  });

  it("cancels a plan edit", async () => {
    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /edit push day/i })
    );
    expect(
      await screen.findByRole("heading", { name: "Edit training plan" })
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.queryByRole("heading", { name: "Edit training plan" })
    ).not.toBeInTheDocument();
    expect(updatePlan).not.toHaveBeenCalled();
  });

  it("deletes a plan from the plan list", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /delete push day/i })
    );

    await waitFor(() => {
      expect(deletePlan).toHaveBeenCalledWith("plan-1");
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Push Day" })
      ).not.toBeInTheDocument();
    });
  });

  it("rejects a plan that repeats an exercise", async () => {
    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Repeated" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /add exercise/i }));
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect(
      await screen.findByText("Each exercise can only be added once")
    ).toBeInTheDocument();
    expect(createPlan).not.toHaveBeenCalled();
  });

  it("adds a plan to the rotation", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });
    vi.mocked(listAllPlans).mockResolvedValueOnce([plan, extraPlan]);

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.change(
      await screen.findByLabelText("Add plan to rotation"),
      { target: { value: extraPlan.id } }
    );
    const addButton = screen.getByRole("button", { name: /^add$/i });
    await waitFor(() => expect(addButton).toBeEnabled());
    await fireEvent.click(addButton);

    await waitFor(() => {
      expect(setRotation).toHaveBeenCalledWith({
        planIds: [plan.id, extraPlan.id],
      });
    });
  });

  it("reorders and removes rotation plans", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan, extraPlan],
      nextPlanId: plan.id,
    });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      await screen.findByRole("button", { name: /move pull day up/i })
    );
    await waitFor(() => {
      expect(setRotation).toHaveBeenCalledWith({
        planIds: [extraPlan.id, plan.id],
      });
    });

    await fireEvent.click(
      screen.getByRole("button", { name: /remove push day/i })
    );
    await waitFor(() => {
      expect(setRotation).toHaveBeenLastCalledWith({
        planIds: [extraPlan.id],
      });
    });
  });

  it("disables rotation controls while saving", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan, extraPlan],
      nextPlanId: plan.id,
    });
    let resolveSave!: (rotation: WorkoutRotation) => void;
    vi.mocked(setRotation).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      await screen.findByRole("button", { name: /move pull day up/i })
    );

    expect(
      screen.getByRole("button", { name: /remove pull day/i })
    ).toBeDisabled();

    resolveSave({ plans: [plan, extraPlan], nextPlanId: plan.id });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /remove pull day/i })
      ).toBeEnabled();
    });
  });

  it("shows an error when saving the rotation fails", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });
    vi.mocked(setRotation).mockRejectedValueOnce(
      new ApiError(422, "Unknown plan IDs: missing")
    );

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      await screen.findByRole("button", { name: /remove push day/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unknown plan IDs: missing"
    );
  });

  it("refreshes the rotation after deleting a plan", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(getRotation)
      .mockResolvedValueOnce({ plans: [plan], nextPlanId: plan.id })
      .mockResolvedValueOnce({ plans: [], nextPlanId: null });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      await screen.findByRole("button", { name: /delete push day/i })
    );

    expect(
      await screen.findByText("Add plans to set up a rotation")
    ).toBeInTheDocument();
  });

  it("renames the plan in the rotation after editing", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });
    vi.mocked(updatePlan).mockResolvedValueOnce({ ...plan, name: "Push Day A" });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      await screen.findByRole("button", { name: /edit push day/i })
    );
    await fireEvent.input(await screen.findByLabelText("Name"), {
      target: { value: "Push Day A" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { name: "Push Day A" })
      ).toHaveLength(3);
    });
  });

  it("refreshes the next rotation plan after finishing a workout", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(session);
    vi.mocked(getRotation)
      .mockResolvedValueOnce({ plans: [plan, extraPlan], nextPlanId: plan.id })
      .mockResolvedValueOnce({ plans: [plan, extraPlan], nextPlanId: extraPlan.id });

    render(GymView);

    await fireEvent.click(
      await screen.findByRole("button", { name: /finish workout/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Pull Day" })
    ).toBeInTheDocument();
  });

  it("logs a set and finishes the active session", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(session);

    render(GymView);

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText("Weight (kg)"), {
      target: { value: "80" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "8" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(addSet).toHaveBeenCalledWith("session-1", {
        exerciseId: "exercise-1",
        weightKg: 80,
        reps: 8,
        rpe: undefined,
      });
    });

    await fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));

    await waitFor(() => {
      expect(completeSession).toHaveBeenCalledWith("session-1");
    });
    expect(await startScreenReady()).toBeInTheDocument();
  });

  it("retries the start once when the conflict leaves no active session", async () => {
    vi.mocked(startSession).mockRejectedValueOnce(
      new ApiError(409, "An active session is already in progress")
    );

    render(GymView);

    await fireEvent.click(await startScreenReady());
    await fireEvent.click(
      await screen.findByRole("button", { name: /free workout/i })
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /finish workout/i })
    ).toBeInTheDocument();
  });

  it("stops adding plan exercises at the schema limit", async () => {
    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));

    const addButton = screen.getByRole("button", { name: /add exercise/i });
    for (let index = 0; index < 49; index += 1) {
      await fireEvent.click(addButton);
    }

    expect(screen.getByRole("button", { name: /add exercise/i })).toBeDisabled();
  });

  it("shows an error when the retried start also fails", async () => {
    vi.mocked(startSession)
      .mockRejectedValueOnce(new ApiError(409, "conflict"))
      .mockRejectedValueOnce(new Error("still blocked"));

    render(GymView);

    await fireEvent.click(await startScreenReady());
    await fireEvent.click(
      await screen.findByRole("button", { name: /free workout/i })
    );

    expect(await screen.findByText("still blocked")).toBeInTheDocument();
  });

  it("shows a duplicate plan name error", async () => {
    vi.mocked(createPlan).mockRejectedValueOnce(
      new ApiError(409, "A plan with this name already exists")
    );

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Push Day" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect(
      await screen.findByText("A plan with this name already exists")
    ).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    vi.mocked(listAllPlans).mockRejectedValueOnce(new Error("Backend unavailable"));

    render(GymView);

    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await startScreenReady()).toBeInTheDocument();
  });

  it("prefills plan targets from exercise defaults", async () => {
    vi.mocked(createPlan).mockResolvedValueOnce({
      ...plan,
      id: "plan-2",
      name: "Default Plan",
    });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));

    expect(screen.getByLabelText("Sets")).toHaveValue(4);
    expect(screen.getByLabelText("Reps")).toHaveValue(8);
    expect(screen.getByLabelText("Weight (kg, optional)")).toHaveValue(80);

    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Default Plan" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => {
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: [
            expect.objectContaining({
              targetSets: 4,
              targetReps: 8,
              targetWeightKg: 80,
            }),
          ],
        })
      );
    });
  });

  it("prefills changed plan rows from the selected exercise defaults", async () => {
    vi.mocked(listAllExercises).mockResolvedValueOnce([exercise, extraExercise]);

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    expect(screen.getByLabelText("Sets")).toHaveValue(4);

    await fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: extraExercise.id },
    });

    expect(screen.getByLabelText("Sets")).toHaveValue(5);
    expect(screen.getByLabelText("Reps")).toHaveValue(5);
    expect(screen.getByLabelText("Weight (kg, optional)")).toHaveValue(100);
  });

  it("creates an exercise in the register", async () => {
    const created = { ...exercise, id: "exercise-2", name: "Cable Fly" };
    vi.mocked(createExercise).mockResolvedValueOnce(created);

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(screen.getByRole("button", { name: /new exercise/i }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Cable Fly" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save exercise/i }));

    await waitFor(() => {
      expect(createExercise).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Cable Fly", muscleGroup: "chest" })
      );
    });
    expect(await screen.findByText("Cable Fly")).toBeInTheDocument();
  });

  it("updates exercise names in the next workout after a rename", async () => {
    vi.mocked(getRotation).mockResolvedValueOnce({
      plans: [plan],
      nextPlanId: plan.id,
    });
    vi.mocked(updateExercise).mockResolvedValueOnce({
      ...exercise,
      name: "Bench Press Pro",
    });

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Bench Press Pro" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save exercise/i }));

    expect(
      await screen.findAllByText("Bench Press Pro")
    ).toHaveLength(2);
  });

  it("deletes an exercise from the register", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(GymView);

    await startScreenReady();
    await openManagement();
    await fireEvent.click(
      screen.getByRole("button", { name: /delete bench press/i })
    );

    await waitFor(() => {
      expect(deleteExercise).toHaveBeenCalledWith("exercise-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
    });
  });
});
