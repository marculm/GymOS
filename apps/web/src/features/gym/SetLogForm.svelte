<script lang="ts">
  import { tick } from "svelte";
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import type { CreateWorkoutSetInput, Exercise } from "@gymos/shared";
  import { formatWeight } from "./format.mts";

  type SetInput = Omit<CreateWorkoutSetInput, "exerciseId">;

  let {
    exercise,
    disabled = false,
    onSubmit,
  }: {
    exercise: Exercise;
    disabled?: boolean;
    onSubmit: (input: SetInput) => Promise<boolean>;
  } = $props();

  let weightKg = $state<string | number | null>("");
  let reps = $state<string | number | null>("");
  let idempotencyKey = $state<string | null>(null);
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const weightPlaceholder = $derived(exercise.defaultWeightKg ?? undefined);

  function isEmpty(value: string | number | null) {
    return value === "" || value == null;
  }

  async function submitOnEnter(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const form = (event.currentTarget as HTMLInputElement).form;
    if (isEmpty(weightKg) && weightPlaceholder != null) {
      weightKg = weightPlaceholder;
      await tick();
    }
    form?.requestSubmit();
  }

  async function submitSet() {
    if (disabled || submitting || isEmpty(weightKg) || isEmpty(reps)) return;

    submitting = true;
    error = null;

    try {
      idempotencyKey ??= crypto.randomUUID();
      const logged = await onSubmit({
        weightKg: Number(weightKg),
        reps: Number(reps),
        idempotencyKey,
      });
      if (!logged) return;
      idempotencyKey = null;
      weightKg = "";
      reps = "";
    } catch (logError) {
      error =
        logError instanceof Error ? logError.message : "Could not log the set";
    } finally {
      submitting = false;
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await submitSet();
  }
</script>

<form
  class="stack"
  aria-label={`Add set for ${exercise.name}`}
  onsubmit={handleSubmit}
>
  <fieldset class="stack" disabled={disabled}>
    <div class="row set-fields">
      <label class="field set-field">
        <span class="label">Reps</span>
        <input
          class="input"
          type="number"
          min={1}
          max={MAX_SET_REPS}
          required
          bind:value={reps}
        />
      </label>
      <label class="field set-field">
        <span class="label">Weight (kg)</span>
        <input
          class="input"
          type="number"
          min={0}
          max={MAX_SET_WEIGHT_KG}
          step={0.01}
          required
          placeholder={
            weightPlaceholder == null
              ? undefined
              : formatWeight(weightPlaceholder)
          }
          bind:value={weightKg}
          onkeydown={submitOnEnter}
        />
      </label>
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button
      type="submit"
      class="btn btn-primary"
      aria-label={`Add set for ${exercise.name}`}
      disabled={disabled}
    >
      Add set
    </button>
  </fieldset>
</form>
