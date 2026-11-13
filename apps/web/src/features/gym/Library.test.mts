import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Exercise, WorkoutPlan } from "@gymos/shared";
import {
  createPlan,
  deletePlan,
  getRotation,
  listAllExercises,
  listAllPlans,
  setRotation,
  updatePlan,
} from "../../api/gym.mts";
import { gymData } from "./gym-data.svelte.ts";
import Library from "./Library.svelte";

vi.mock("../../api/gym.mts", () => ({
  listAllExercises: vi.fn(),
  listAllPlans: vi.fn(),
  getRotation: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  setRotation: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
}));

const exercise: Exercise = {
  id: "ex-1",
  name: "Barbell Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
  createdAt: "2026-11-13T18:00:00.000Z",
  exercises: [
    {
      id: "plan-ex-1",
      position: 0,
      targetSets: 3,
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
};

function rotation(plans: WorkoutPlan[], nextPlanId: string | null) {
  return { plans, nextPlanId };
}

function mockDefaults(plans: WorkoutPlan[] = [plan], nextPlanId = plan.id) {
  vi.mocked(listAllExercises).mockResolvedValue([exercise]);
  vi.mocked(listAllPlans).mockResolvedValue(plans);
  vi.mocked(getRotation).mockResolvedValue(rotation([plan], nextPlanId));
  vi.mocked(createPlan).mockResolvedValue({ ...plan, id: "plan-3", name: "Leg Day" });
  vi.mocked(updatePlan).mockResolvedValue({ ...plan, name: "Push Day A" });
  vi.mocked(deletePlan).mockResolvedValue(undefined);
  vi.mocked(setRotation).mockResolvedValue(rotation(plans, nextPlanId));
}

beforeEach(() => {
  gymData.reset();
  vi.clearAllMocks();
  mockDefaults();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Library", () => {
  it("shows the rotation and plans", async () => {
    render(Library, { props: { view: "plans" } });

    expect(
      await screen.findByRole("heading", { name: "Training rotation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Training plans" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Push Day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 exercise")).toHaveLength(1);
  });

  it("creates a plan", async () => {
    render(Library, { props: { view: "plans" } });

    await screen.findAllByText("Push Day");
    await fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Leg Day" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() =>
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Leg Day" })
      )
    );
    await waitFor(() =>
      expect(screen.getAllByText("Leg Day").length).toBeGreaterThan(0)
    );
  });

  it("edits a plan", async () => {
    render(Library, { props: { view: "plans" } });

    await screen.findAllByText("Push Day");
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit Push Day" })
    );
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Push Day A" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() =>
      expect(updatePlan).toHaveBeenCalledWith(
        plan.id,
        expect.objectContaining({ name: "Push Day A" })
      )
    );
    expect(await screen.findAllByText("Push Day A")).not.toHaveLength(0);
  });

  it("deletes a plan after confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(Library, { props: { view: "plans" } });

    await screen.findAllByText("Push Day");
    await fireEvent.click(
      screen.getByRole("button", { name: "Delete Push Day" })
    );

    await waitFor(() => expect(deletePlan).toHaveBeenCalledWith(plan.id));
  });

  it("reorders and removes rotation plans", async () => {
    vi.mocked(getRotation).mockResolvedValue(
      rotation([plan, extraPlan], plan.id)
    );
    vi.mocked(listAllPlans).mockResolvedValue([plan, extraPlan]);
    vi.mocked(setRotation)
      .mockResolvedValueOnce(rotation([extraPlan, plan], plan.id))
      .mockResolvedValueOnce(rotation([extraPlan], extraPlan.id));

    render(Library, { props: { view: "plans" } });

    await screen.findAllByText("Pull Day");
    await fireEvent.click(
      screen.getByRole("button", { name: "Move Pull Day up" })
    );
    await waitFor(() =>
      expect(setRotation).toHaveBeenCalledWith({
        planIds: [extraPlan.id, plan.id],
      })
    );

    await fireEvent.click(
      screen.getByRole("button", { name: "Remove Push Day from rotation" })
    );
    await waitFor(() =>
      expect(setRotation).toHaveBeenLastCalledWith({
        planIds: [extraPlan.id],
      })
    );
  });

  it("adds a plan to the rotation", async () => {
    vi.mocked(listAllPlans).mockResolvedValue([plan, extraPlan]);
    vi.mocked(setRotation).mockResolvedValue(
      rotation([plan, extraPlan], plan.id)
    );

    render(Library, { props: { view: "plans" } });

    await screen.findAllByText("Pull Day");
    await fireEvent.change(screen.getByLabelText("Add plan to rotation"), {
      target: { value: extraPlan.id },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(setRotation).toHaveBeenCalledWith({
        planIds: [plan.id, extraPlan.id],
      })
    );
  });
});
