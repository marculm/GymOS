import { describe, expect, it, vi, type Mock } from "vitest";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmitInput = { reps: number; weightKg: number; idempotencyKey: string };

function renderForm(
  overrides: {
    exercise?: Exercise;
    onSubmit?: Mock<(input: SubmitInput) => Promise<boolean>>;
  } = {}
) {
  const onSubmit =
    overrides.onSubmit ??
    vi.fn<(input: SubmitInput) => Promise<boolean>>().mockResolvedValue(true);

  render(SetLogForm, {
    props: {
      exercise,
      ...overrides,
      onSubmit,
    },
  });

  return {
    onSubmit,
    weight: screen.getByLabelText("Weight (kg)"),
    reps: screen.getByLabelText("Reps"),
    submit: () =>
      fireEvent.submit(
        screen.getByRole("form", { name: "Add set for Bench Press" })
      ),
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
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reps: 8,
          weightKg: 82.5,
          idempotencyKey: expect.stringMatching(UUID_PATTERN),
        })
      );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(weight).toHaveFocus();
    expect(reps).not.toHaveFocus();
  });

  it("does not submit when Reps is empty", async () => {
    const { onSubmit, weight } = renderForm({
      exercise: { ...exercise, defaultWeightKg: 82.5 },
    });

    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
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
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reps: 8,
          weightKg: 65,
          idempotencyKey: expect.stringMatching(UUID_PATTERN),
        })
      );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(reps).not.toHaveFocus();
  });

  it("blocks a three-decimal weight on Enter", async () => {
    const { onSubmit, weight, reps } = renderForm();

    await fireEvent.input(reps, { target: { value: "8" } });
    await fireEvent.input(weight, { target: { value: "22.255" } });
    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
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
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reps: 8,
          weightKg: 22.25,
          idempotencyKey: expect.stringMatching(UUID_PATTERN),
        })
      );
    });
  });

  it("retries a failed submission with the same idempotency key", async () => {
    const onSubmit = vi
      .fn<(input: SubmitInput) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(true);
    const { weight, reps, submit } = renderForm({ onSubmit });

    await fireEvent.input(reps, { target: { value: "8" } });
    await fireEvent.input(weight, { target: { value: "80" } });
    await submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    });

    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const [first, second] = onSubmit.mock.calls;
    expect(first?.[0].idempotencyKey).toMatch(UUID_PATTERN);
    expect(second?.[0].idempotencyKey).toBe(first?.[0].idempotencyKey);
  });

  it("uses a new idempotency key for the next set", async () => {
    const { onSubmit, weight, reps, submit } = renderForm();

    await fireEvent.input(reps, { target: { value: "8" } });
    await fireEvent.input(weight, { target: { value: "80" } });
    await submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    await fireEvent.input(reps, { target: { value: "6" } });
    await fireEvent.input(weight, { target: { value: "82.5" } });
    await submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    const [first, second] = onSubmit.mock.calls;
    expect(second?.[0].idempotencyKey).not.toBe(first?.[0].idempotencyKey);
  });

  it("formats the default weight placeholder", () => {
    renderForm({ exercise: { ...exercise, defaultWeightKg: 22.25 } });

    expect(screen.getByLabelText("Weight (kg)")).toHaveAttribute(
      "placeholder",
      "22.25"
    );
  });

  it("does not submit an empty weight without a default", async () => {
    const { onSubmit, weight, reps } = renderForm();

    await fireEvent.input(reps, { target: { value: "8" } });
    weight.focus();
    await fireEvent.keyDown(weight, { key: "Enter" });

    expect(weight).toHaveValue(null);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
