import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import type { Exercise } from "@gymos/shared";
import SetLogForm from "./SetLogForm.svelte";

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 4,
  defaultReps: 8,
  defaultWeightKg: null,
};

function renderForm(overrides: { exercise?: Exercise; suggestedWeightKg?: number } = {}) {
  const onSubmit = vi.fn().mockResolvedValue(true);

  render(SetLogForm, {
    props: {
      exercise,
      onSubmit,
      ...overrides,
    },
  });

  return {
    onSubmit,
    weight: screen.getByLabelText("Weight (kg)"),
    reps: screen.getByLabelText("Reps"),
  };
}

describe("SetLogForm", () => {
  it("accepts the suggested weight with Enter and focuses Reps", async () => {
    const { onSubmit, weight, reps } = renderForm({ suggestedWeightKg: 82.5 });

    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(82.5);
    expect(reps).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts the exercise default weight as the suggestion", async () => {
    const { weight, reps } = renderForm({
      exercise: { ...exercise, defaultWeightKg: 60 },
    });

    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(60);
    expect(reps).toHaveFocus();
  });

  it("keeps a typed weight instead of the suggestion", async () => {
    const { weight, reps } = renderForm({ suggestedWeightKg: 82.5 });

    await fireEvent.input(weight, { target: { value: "65" } });
    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(65);
    expect(reps).not.toHaveFocus();
  });

  it("keeps the form behavior without a suggestion", async () => {
    const { onSubmit, weight, reps } = renderForm();

    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(null);
    expect(weight).toHaveFocus();
    expect(reps).not.toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
