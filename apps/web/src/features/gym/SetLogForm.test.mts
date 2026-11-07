import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Exercise } from "@gymos/shared";
import { MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
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

function renderForm(overrides: { exercise?: Exercise } = {}) {
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
  it("submits the set with the default weight on Enter", async () => {
    const { onSubmit, weight, reps } = renderForm({
      exercise: { ...exercise, defaultWeightKg: 82.5 },
    });

    await fireEvent.input(reps, { target: { value: "8" } });
    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ reps: 8, weightKg: 82.5 });
    });
    expect(weight).toHaveFocus();
    expect(reps).not.toHaveFocus();
  });

  it("submits a typed weight on Enter instead of the default", async () => {
    const { onSubmit, weight, reps } = renderForm({
      exercise: { ...exercise, defaultWeightKg: 82.5 },
    });

    await fireEvent.input(reps, { target: { value: "8" } });
    await fireEvent.input(weight, { target: { value: "65" } });
    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ reps: 8, weightKg: 65 });
    });
    expect(reps).not.toHaveFocus();
  });

  it("orders Reps before Weight and accepts two decimals", () => {
    const { weight, reps } = renderForm();

    expect(screen.getAllByRole("spinbutton")).toEqual([reps, weight]);
    expect(weight).toHaveAttribute("step", "0.01");
    expect(weight).toHaveAttribute("min", "0");
    expect(weight).toHaveAttribute("max", String(MAX_SET_WEIGHT_KG));
  });

  it("submits a two-decimal weight exactly", async () => {
    const { onSubmit, weight, reps } = renderForm();

    await fireEvent.input(reps, { target: { value: "8" } });
    await fireEvent.input(weight, { target: { value: "22.25" } });
    await fireEvent.submit(
      screen.getByRole("form", { name: "Add set for Bench Press" })
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ reps: 8, weightKg: 22.25 });
    });
  });

  it("formats the default weight placeholder", () => {
    renderForm({ exercise: { ...exercise, defaultWeightKg: 22.25 } });

    expect(screen.getByLabelText("Weight (kg)")).toHaveAttribute(
      "placeholder",
      "22.25"
    );
  });

  it("keeps the form behavior without a default weight", async () => {
    const { onSubmit, weight, reps } = renderForm();

    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(null);
    expect(weight).toHaveFocus();
    expect(reps).not.toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
