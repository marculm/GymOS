<script lang="ts">
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import type { CreateWorkoutSetInput, Exercise } from "@gymos/shared";

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
  let rpe = $state<string | number | null>("");
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const weightPlaceholder = $derived(
    suggestedWeightKg ?? exercise.defaultWeightKg ?? undefined
  );

  function isEmpty(value: string | number | null) {
    return value === "" || value == null;
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
        rpe: rpe == null || rpe === "" ? undefined : Number(rpe),
      });
      if (!logged) return;
      weightKg = "";
      reps = "";
      rpe = "";
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
    <div class="row">
      <label class="field grow">
        <span class="label">Weight (kg)</span>
        <input
          class="input"
          type="number"
          min={0}
          max={MAX_SET_WEIGHT_KG}
          step={0.5}
          required
          placeholder={weightPlaceholder?.toString()}
          bind:value={weightKg}
        />
      </label>
      <label class="field grow">
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
      <label class="field grow">
        <span class="label">RPE (optional)</span>
        <input
          class="input"
          type="number"
          min={1}
          max={10}
          step={0.5}
          bind:value={rpe}
        />
      </label>
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={disabled}>
      Add set
    </button>
  </fieldset>
</form>
