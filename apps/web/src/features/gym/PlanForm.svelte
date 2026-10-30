<script lang="ts">
  import {
    DUPLICATE_EXERCISE_MESSAGE,
    type CreateWorkoutPlanInput,
    type Exercise,
    type WorkoutPlan,
  } from "@gymos/shared";

  let {
    exercises,
    plan = null,
    onSubmit,
  }: {
    exercises: Exercise[];
    plan?: WorkoutPlan | null;
    onSubmit: (input: CreateWorkoutPlanInput) => Promise<void>;
  } = $props();

  type ExerciseRow = {
    exerciseId: string;
    targetSets: number;
    targetReps: number;
    targetWeightKg: number | "";
    notes?: string;
  };

  function planRows(source: WorkoutPlan): ExerciseRow[] {
    return source.exercises.map((entry) => ({
      exerciseId: entry.exercise.id,
      targetSets: entry.targetSets,
      targetReps: entry.targetReps,
      targetWeightKg: entry.targetWeightKg ?? "",
      notes: entry.notes ?? undefined,
    }));
  }

  function createRow(list: Exercise[]): ExerciseRow {
    const exercise = list[0];
    return {
      exerciseId: exercise?.id ?? "",
      targetSets: exercise?.defaultSets ?? 3,
      targetReps: exercise?.defaultReps ?? 8,
      targetWeightKg: exercise?.defaultWeightKg ?? "",
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

  function updateRow(index: number, patch: Partial<ExerciseRow>) {
    rows = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row
    );
  }

  function selectExercise(index: number, exerciseId: string) {
    const exercise = available.find((entry) => entry.id === exerciseId);
    const notes = rows[index]?.exerciseId === exerciseId ? rows[index]?.notes : undefined;
    updateRow(index, {
      exerciseId,
      targetSets: exercise?.defaultSets ?? 3,
      targetReps: exercise?.defaultReps ?? 8,
      targetWeightKg: exercise?.defaultWeightKg ?? "",
      notes,
    });
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
          targetSets: row.targetSets,
          targetReps: row.targetReps,
          targetWeightKg:
            row.targetWeightKg === "" ? undefined : row.targetWeightKg,
          notes: row.notes,
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
{:else}
  <form class="card stack" onsubmit={handleSubmit}>
    <h3 class="card-title">
      {plan ? "Edit training plan" : "New training plan"}
    </h3>

    <label class="field">
      <span class="label">Name</span>
      <input class="input" required maxlength={100} bind:value={name} />
    </label>

    <label class="field">
      <span class="label">Description (optional)</span>
      <input class="input" maxlength={500} bind:value={description} />
    </label>

    <div class="stack">
      {#each rows as row, index (index)}
        <div class="plan-exercise stack">
          <div class="row">
            <label class="field grow">
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
            <button
              type="button"
              class="btn btn-ghost"
              disabled={rows.length === 1}
              onclick={() => removeRow(index)}
            >
              Remove
            </button>
          </div>

          <div class="row">
            <label class="field grow">
              <span class="label">Sets</span>
              <input
                class="input"
                type="number"
                min={1}
                max={20}
                required
                bind:value={row.targetSets}
              />
            </label>
            <label class="field grow">
              <span class="label">Reps</span>
              <input
                class="input"
                type="number"
                min={1}
                max={100}
                required
                bind:value={row.targetReps}
              />
            </label>
            <label class="field grow">
              <span class="label">Weight (kg, optional)</span>
              <input
                class="input"
                type="number"
                min={0}
                step={0.5}
                value={row.targetWeightKg}
                oninput={(event) =>
                  updateRow(index, {
                    targetWeightKg:
                      event.currentTarget.value === ""
                        ? ""
                        : Number(event.currentTarget.value),
                  })}
              />
            </label>
          </div>
        </div>
      {/each}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if rows.length >= MAX_PLAN_EXERCISES}
      <p class="muted">Maximum 50 exercises per plan.</p>
    {/if}

    <div class="row">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={rows.length >= MAX_PLAN_EXERCISES}
        onclick={addRow}
      >
        Add exercise
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        disabled={pending || name.trim().length === 0 || rows.length === 0}
      >
        Save plan
      </button>
    </div>
  </form>
{/if}
