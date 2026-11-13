import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Exercise } from "@gymos/shared";
import { MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
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

async function submitExerciseForm() {
  const form = screen.getByLabelText("Name").closest("form");
  if (!form) throw new Error("exercise form is missing");
  await fireEvent.submit(form);
}

const squat: Exercise = {
  id: "exercise-2",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
  defaultSets: 5,
  defaultReps: 5,
  defaultWeightKg: 100,
};

function renderRegister(exercises: Exercise[] = [exercise]) {
  const onCreate = vi.fn().mockResolvedValue(exercise);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);

  render(ExerciseRegister, {
    props: {
      exercises,
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

  it("renders the edit form inside the exercise group", async () => {
    renderRegister();

    const editButton = screen.getByRole("button", {
      name: /edit bench press/i,
    });
    const group = editButton.closest(".exercises-group");
    if (!group) throw new Error("exercise group is missing");

    await fireEvent.click(editButton);

    const nameInput = screen.getByLabelText("Name");
    const form = nameInput.closest("form");
    expect(form).not.toBeNull();
    expect(group.contains(form)).toBe(true);
    for (const renderedForm of document.querySelectorAll("form")) {
      expect(renderedForm.closest(".exercises-group")).not.toBeNull();
    }
    expect(nameInput).toHaveFocus();
  });

  it("renders the new exercise form as the first item in the group", async () => {
    renderRegister();

    await fireEvent.click(screen.getByRole("button", { name: /new exercise/i }));

    const nameInput = screen.getByLabelText("Name");
    const group = document.querySelector(".exercises-group");
    expect(group?.firstElementChild?.contains(nameInput)).toBe(true);
    expect(nameInput).toHaveFocus();
  });

  it("closes the open editor when another exercise is edited", async () => {
    renderRegister([exercise, squat]);

    const squatGroup = screen
      .getByRole("button", { name: /edit squat/i })
      .closest(".exercises-group");
    if (!squatGroup) throw new Error("exercise group is missing");

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    await screen.findByRole("heading", { name: "Edit exercise" });
    await fireEvent.click(screen.getByRole("button", { name: /edit squat/i }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { name: "Edit exercise" })
      ).toHaveLength(1);
    });
    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveValue("Squat");
    expect(squatGroup.contains(nameInput)).toBe(true);
  });

  it("returns focus to the Edit button after saving", async () => {
    const { onUpdate } = renderRegister();

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Incline Bench Press" },
    });
    await submitExerciseForm();

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /edit bench press/i })
      ).toHaveFocus();
    });
  });

  it("returns focus to the Edit button after cancel", async () => {
    renderRegister();

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    expect(
      screen.getByRole("heading", { name: "Edit exercise" })
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.queryByRole("heading", { name: "Edit exercise" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bench Press" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /edit bench press/i })
      ).toHaveFocus();
    });
  });

  it("displays a two-decimal default and accepts two-decimal input", async () => {
    render(ExerciseRegister, {
      props: {
        exercises: [{ ...exercise, defaultWeightKg: 22.25 }],
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
      },
    });

    expect(screen.getByText(/@ 22.25 kg/)).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    expect(
      screen.getByLabelText("Weight (kg)")
    ).toHaveAttribute("step", "0.01");
  });

  it("bounds the default weight at the set weight limit", async () => {
    renderRegister();

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );

    expect(
      screen.getByLabelText("Weight (kg)")
    ).toHaveAttribute("max", String(MAX_SET_WEIGHT_KG));
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
    await fireEvent.input(screen.getByLabelText("Sets"), {
      target: { value: "5" },
    });
    await fireEvent.input(screen.getByLabelText("Reps"), {
      target: { value: "12" },
    });
    await fireEvent.input(screen.getByLabelText("Weight (kg)"), {
      target: { value: "15.5" },
    });
    await submitExerciseForm();

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
    await submitExerciseForm();

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "exercise-1",
        expect.objectContaining({ name: "Incline Bench Press" })
      );
    });
  });

  it("keeps the form open and announces a failed save", async () => {
    const { onUpdate } = renderRegister();
    onUpdate.mockRejectedValueOnce(new Error("Name already exists"));

    const group = screen
      .getByRole("button", { name: /edit bench press/i })
      .closest(".exercises-group");
    if (!group) throw new Error("exercise group is missing");

    await fireEvent.click(
      screen.getByRole("button", { name: /edit bench press/i })
    );
    await fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Incline Bench Press" },
    });
    await submitExerciseForm();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Name already exists");
    expect(group.contains(alert)).toBe(true);
    expect(screen.getByLabelText("Name")).toHaveValue("Incline Bench Press");
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
