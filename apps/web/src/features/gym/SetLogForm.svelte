<script lang="ts">
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import type { CreateWorkoutSetInput, Exercise } from "@gymos/shared";

  type SetInput = Omit<CreateWorkoutSetInput, "exerciseId">;

  let {
    exercise,
    disabled = false,
    onSubmit,
  }: {
    exercise: Exercise;
    disabled?: boolean;
    onSubmit: (input: SetInput) => Promise<void>;
  } = $props();

  // svelte-ignore state_referenced_locally
  let weightKg = $state<string | number | null>(exercise.defaultWeightKg ?? "");
  // svelte-ignore state_referenced_locally
  let reps = $state<string | number | null>(exercise.defaultReps ?? "");
  let rpe = $state<string | number | null>("");

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (disabled) return;

    try {
      await onSubmit({
        weightKg: Number(weightKg),
        reps: Number(reps),
        rpe: rpe == null || rpe === "" ? undefined : Number(rpe),
      });
      weightKg = "";
      reps = "";
      rpe = "";
    } catch {
      // SessionView shows the error; keep the typed values.
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

    <button type="submit" class="btn btn-primary" disabled={disabled}>
      Add set
    </button>
  </fieldset>
</form>
