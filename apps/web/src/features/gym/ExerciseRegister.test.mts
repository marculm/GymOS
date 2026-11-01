import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Exercise } from "@gymos/shared";
import ExerciseRegister from "./ExerciseRegister.svelte";

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: "Compound chest press",
  defaultSets: 4,
  defaultReps: 8,
  defaultWeightKg: 80,
};

function renderRegister() {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);

  render(ExerciseRegister, {
    props: {
      exercises: [exercise],
      onCreate,
      onUpdate,
      onDelete,
    },
  });

  return { onCreate, onUpdate, onDelete };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExerciseRegister", () => {
  it("renders the register with defaults", () => {
    renderRegister();

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText(/4\s*×\s*8/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80 kg/)).toBeInTheDocument();
  });

  it("creates an exercise with defaults", async () => {
    const { onCreate } = renderRegister();

    await fireEvent.click(screen.getByRole("button", { name: /new exercise/i }));
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Cable Fly" },
    });
    await fireEvent.change(screen.getByLabelText("Muscle group"), {
      target: { value: "back" },
    });
    await fireEvent.input(screen.getByLabelText("Default sets"), {
      target: { value: "5" },
    });
    await fireEvent.input(screen.getByLabelText("Default reps"), {
      target: { value: "12" },
    });
    await fireEvent.input(screen.getByLabelText("Default weight (kg, optional)"), {
      target: { value: "15.5" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save exercise/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "Cable Fly",
        muscleGroup: "back",
        description: null,
        defaultSets: 5,
        defaultReps: 12,
        defaultWeightKg: 15.5,
      });
    });
  });

  it("edits an exercise", async () => {
    const { onUpdate } = renderRegister();

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Bench Press");
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Incline Bench Press" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /save exercise/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "exercise-1",
        expect.objectContaining({ name: "Incline Bench Press" })
      );
    });
  });

  it("announces a failed delete", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { onDelete } = renderRegister();
    onDelete.mockRejectedValueOnce(new Error("Cannot delete"));

    await fireEvent.click(
      screen.getByRole("button", { name: /delete bench press/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot delete");
  });

  it("deletes an exercise after confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { onDelete } = renderRegister();

    await fireEvent.click(
      screen.getByRole("button", { name: /delete bench press/i })
    );

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("exercise-1");
    });
  });
});
