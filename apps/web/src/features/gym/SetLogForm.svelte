<script lang="ts">
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import type { CreateWorkoutSetInput, Exercise } from "@gymos/shared";
  import { formatWeight } from "./format.mts";

  type SetInput = Omit<CreateWorkoutSetInput, "exerciseId">;

  let {
    exercise,
    suggestedWeightKg,
    disabled = false,
    onSubmit,
  }: {
    exercise: Exercise;
    suggestedWeightKg?: number;
    disabled?: boolean;
    onSubmit: (input: SetInput) => Promise<boolean>;
  } = $props();

  let weightKg = $state<string | number | null>("");
  let reps = $state<string | number | null>("");
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let repsInput = $state<HTMLInputElement>();

  const weightPlaceholder = $derived(
    suggestedWeightKg ?? exercise.defaultWeightKg ?? undefined
  );

  function isEmpty(value: string | number | null) {
    return value === "" || value == null;
  }

  function acceptSuggestionOnEnter(event: KeyboardEvent) {
    if (event.key !== "Enter" || !isEmpty(weightKg) || weightPlaceholder == null) {
      return;
    }
    event.preventDefault();
    weightKg = weightPlaceholder;
    repsInput?.focus();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (disabled || submitting || isEmpty(weightKg) || isEmpty(reps)) return;

    submitting = true;
    error = null;

    try {
      const logged = await onSubmit({
        weightKg: Number(weightKg),
        reps: Number(reps),
      });
      if (!logged) return;
      weightKg = "";
      reps = "";
    } catch (logError) {
      error =
        logError instanceof Error ? logError.message : "Could not log the set";
    } finally {
      submitting = false;
    }
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
          bind:this={repsInput}
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
          onkeydown={acceptSuggestionOnEnter}
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
