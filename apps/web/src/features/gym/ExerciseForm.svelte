<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { MUSCLE_GROUPS } from "@gymos/shared/labels";
  import type { CreateExerciseInput, Exercise } from "@gymos/shared";
  import { MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";

  let {
    exercise = null,
    onSubmit,
    onCancel,
  }: {
    exercise?: Exercise | null;
    onSubmit: (input: CreateExerciseInput) => Promise<void>;
    onCancel: () => void;
  } = $props();

  // Reads the exercise once; callers remount the form when it changes.
  let name = $state(untrack(() => exercise?.name ?? ""));
  let muscleGroup = $state<Exercise["muscleGroup"]>(
    untrack(() => exercise?.muscleGroup ?? "chest")
  );
  let description = $state(untrack(() => exercise?.description ?? ""));
  let defaultSets = $state<number | string>(
    untrack(() => exercise?.defaultSets ?? 3)
  );
  let defaultReps = $state<number | string>(
    untrack(() => exercise?.defaultReps ?? 8)
  );
  let defaultWeightKg = $state<number | string>(
    untrack(() => exercise?.defaultWeightKg ?? "")
  );
  let pending = $state(false);
  let error = $state<string | null>(null);
  let nameInput = $state<HTMLInputElement | null>(null);

  onMount(() => nameInput?.focus());

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;

    pending = true;
    error = null;

    const input: CreateExerciseInput = {
      name: name.trim(),
      muscleGroup,
      description: description.trim() || null,
      defaultSets: Number(defaultSets),
      defaultReps: Number(defaultReps),
      defaultWeightKg:
        defaultWeightKg === "" ? null : Number(defaultWeightKg),
    };

    try {
      await onSubmit(input);
    } catch (submitError) {
      error =
        submitError instanceof Error
          ? submitError.message
          : "Could not save the exercise";
    } finally {
      pending = false;
    }
  }
</script>

<form
  class="stack"
  aria-label={exercise ? "Edit exercise" : "New exercise"}
  onsubmit={handleSubmit}
>
  <h3 class="card-title form-title">
    {exercise ? "Edit exercise" : "New exercise"}
  </h3>

  <div class="form-rows">
    <label class="field">
      <span class="label">Name</span>
      <input
        class="input"
        required
        maxlength={100}
        placeholder="Exercise name"
        bind:this={nameInput}
        bind:value={name}
      />
    </label>

    <label class="field">
      <span class="label">Muscle group</span>
      <select
        class="input"
        value={muscleGroup}
        onchange={(event) =>
          (muscleGroup = event.currentTarget.value as Exercise["muscleGroup"])}
      >
        {#each MUSCLE_GROUPS as group (group)}
          <option value={group}>{group}</option>
        {/each}
      </select>
    </label>

    <label class="field">
      <span class="label">Sets</span>
      <input
        class="input"
        type="number"
        min={1}
        max={20}
        required
        bind:value={defaultSets}
      />
    </label>

    <label class="field">
      <span class="label">Reps</span>
      <input
        class="input"
        type="number"
        min={1}
        max={100}
        required
        bind:value={defaultReps}
      />
    </label>

    <label class="field">
      <span class="label">Weight (kg)</span>
      <input
        class="input"
        type="number"
        min={0}
        max={MAX_SET_WEIGHT_KG}
        step={0.01}
        placeholder="Optional"
        value={defaultWeightKg}
        oninput={(event) =>
          (defaultWeightKg =
            event.currentTarget.value === ""
              ? ""
              : Number(event.currentTarget.value))}
      />
    </label>

    <label class="field field-block">
      <span class="label">Description</span>
      <textarea
        class="input"
        rows="2"
        maxlength={500}
        placeholder="Optional"
        bind:value={description}
      ></textarea>
    </label>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="form-actions">
    <button
      type="submit"
      class="btn btn-primary"
      disabled={pending || name.trim().length === 0}
    >
      Save exercise
    </button>
    <button
      type="button"
      class="btn btn-ghost"
      disabled={pending}
      onclick={onCancel}
    >
      Cancel
    </button>
  </div>
</form>
