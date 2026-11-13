<script lang="ts">
  import { onMount } from "svelte";
  import type {
    CreateWorkoutPlanInput,
    Exercise,
    WorkoutPlan,
  } from "@gymos/shared";
  import { DUPLICATE_EXERCISE_MESSAGE } from "@gymos/shared/labels";

  let {
    exercises,
    plan = null,
    onSubmit,
    onCancel,
  }: {
    exercises: Exercise[];
    plan?: WorkoutPlan | null;
    onSubmit: (input: CreateWorkoutPlanInput) => Promise<void>;
    onCancel: () => void;
  } = $props();

  let nameInput = $state<HTMLInputElement | null>(null);

  onMount(() => nameInput?.focus());

  type ExerciseRow = {
    exerciseId: string;
    notes?: string;
  };

  function planRows(source: WorkoutPlan): ExerciseRow[] {
    return source.exercises.map((entry) => ({
      exerciseId: entry.exercise.id,
      notes: entry.notes ?? undefined,
    }));
  }

  function createRow(list: Exercise[]): ExerciseRow {
    const exercise = list[0];
    return {
      exerciseId: exercise?.id ?? "",
    };
  }

  const available = $derived([
    ...exercises,
    ...(plan?.exercises ?? [])
      .map((entry) => entry.exercise)
      .filter(
        (exercise) => !exercises.some((active) => active.id === exercise.id)
      ),
  ]);

  // svelte-ignore state_referenced_locally
  let name = $state(plan?.name ?? "");
  // svelte-ignore state_referenced_locally
  let description = $state(plan?.description ?? "");
  // svelte-ignore state_referenced_locally
  let rows = $state<ExerciseRow[]>(plan ? planRows(plan) : [createRow(exercises)]);
  let pending = $state(false);
  let error = $state<string | null>(null);

  function selectExercise(index: number, exerciseId: string) {
    const notes = rows[index]?.exerciseId === exerciseId ? rows[index]?.notes : undefined;
    rows = rows.map((row, rowIndex) =>
      rowIndex === index ? { exerciseId, notes } : row
    );
  }

  const MAX_PLAN_EXERCISES = 50;

  function addRow() {
    if (rows.length >= MAX_PLAN_EXERCISES) return;
    rows = [...rows, createRow(exercises)];
  }

  function removeRow(index: number) {
    rows = rows.filter((_, rowIndex) => rowIndex !== index);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;

    const exerciseIds = rows.map((row) => row.exerciseId);
    if (new Set(exerciseIds).size !== exerciseIds.length) {
      error = DUPLICATE_EXERCISE_MESSAGE;
      return;
    }

    pending = true;
    error = null;

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        exercises: rows.map((row) => ({
          exerciseId: row.exerciseId,
          notes: row.notes?.trim() || undefined,
        })),
      });
      if (!plan) {
        name = "";
        description = "";
        rows = [createRow(exercises)];
      }
    } catch (submitError) {
      error =
        submitError instanceof Error
          ? submitError.message
          : "Could not save the plan";
    } finally {
      pending = false;
    }
  }
</script>

{#if available.length === 0}
  <p class="empty">No exercises available. Add one in the exercise register.</p>
  <button type="button" class="btn btn-ghost" onclick={onCancel}>
    Cancel
  </button>
{:else}
  <form class="stack" onsubmit={handleSubmit}>
    <h3 class="card-title form-title">
      {plan ? "Edit training plan" : "New training plan"}
    </h3>

    <div class="form-rows">
      <label class="field">
        <span class="label">Name</span>
        <input
          class="input"
          required
          maxlength={100}
          placeholder="Plan name"
          bind:this={nameInput}
          bind:value={name}
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

    <div class="plan-exercises">
      {#each rows as row, index (index)}
        {@const rowExercise = available.find(
          (entry) => entry.id === row.exerciseId
        )}
        <div class="plan-exercise">
          <div class="form-rows">
            <label class="field">
              <span class="label">Exercise</span>
              <select
                class="input"
                required
                value={row.exerciseId}
                onchange={(event) =>
                  selectExercise(index, event.currentTarget.value)}
              >
                {#each available as exercise (exercise.id)}
                  <option value={exercise.id}>{exercise.name}</option>
                {/each}
              </select>
            </label>
            <label class="field field-block">
              <span class="label">Notes</span>
              <textarea
                class="input"
                rows="2"
                maxlength={500}
                placeholder="Optional"
                aria-label={`Notes (optional) for ${rowExercise?.name ?? "exercise"}`}
                bind:value={row.notes}
              ></textarea>
            </label>
          </div>
          <button
            type="button"
            class="remove-exercise"
            aria-label={`Remove ${rowExercise?.name ?? "exercise"}`}
            disabled={rows.length === 1}
            onclick={() => removeRow(index)}
          >
            Remove
          </button>
        </div>
      {/each}
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if rows.length >= MAX_PLAN_EXERCISES}
      <p class="muted form-note">Maximum 50 exercises per plan.</p>
    {/if}

    <div class="form-actions">
      <button
        type="submit"
        class="btn btn-primary"
        disabled={pending || name.trim().length === 0 || rows.length === 0}
      >
        Save plan
      </button>
      <button
        type="button"
        class="btn btn-ghost"
        disabled={rows.length >= MAX_PLAN_EXERCISES}
        onclick={addRow}
      >
        Add exercise
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
{/if}
