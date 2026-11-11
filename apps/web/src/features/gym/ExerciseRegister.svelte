<script lang="ts">
  import type { CreateExerciseInput, Exercise } from "@gymos/shared";
  import ExerciseForm from "./ExerciseForm.svelte";
  import { formatWeight } from "./format.mts";

  let {
    exercises,
    onCreate,
    onUpdate,
    onDelete,
  }: {
    exercises: Exercise[];
    onCreate: (input: CreateExerciseInput) => Promise<void>;
    onUpdate: (id: string, input: CreateExerciseInput) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
  } = $props();

  let editingExercise = $state<Exercise | null>(null);
  let formOpen = $state(false);
  let error = $state<string | null>(null);

  function openCreate() {
    editingExercise = null;
    error = null;
    formOpen = true;
  }

  function openEdit(exercise: Exercise) {
    editingExercise = exercise;
    error = null;
    formOpen = true;
  }

  function close() {
    formOpen = false;
    editingExercise = null;
  }

  async function handleSubmit(input: CreateExerciseInput) {
    if (editingExercise) {
      await onUpdate(editingExercise.id, input);
    } else {
      await onCreate(input);
    }
    close();
  }

  async function handleDelete(exercise: Exercise) {
    if (!confirm(`Delete ${exercise.name}? Past workouts keep their records.`)) {
      return;
    }

    error = null;
    try {
      await onDelete(exercise.id);
      if (editingExercise?.id === exercise.id) close();
    } catch (deleteError) {
      error =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the exercise";
    }
  }
</script>

<div class="stack">
  <div class="card-grid">
    {#if formOpen && !editingExercise}
      <article class="card stack form-card">
        <ExerciseForm onSubmit={handleSubmit} onCancel={close} />
      </article>
    {/if}

    {#each exercises as exercise (exercise.id)}
      <article
        class="card stack"
        class:form-card={editingExercise?.id === exercise.id}
      >
        {#if editingExercise?.id === exercise.id}
          <ExerciseForm
            exercise={editingExercise}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        {:else}
          <div class="row">
            <h3 class="card-title">{exercise.name}</h3>
            <span class="badge">{exercise.muscleGroup}</span>
          </div>
          <p class="muted">
            Default: {exercise.defaultSets} × {exercise.defaultReps}
            {exercise.defaultWeightKg != null
              ? ` @ ${formatWeight(exercise.defaultWeightKg)} kg`
              : ""}
          </p>
          <div class="row">
            <button
              type="button"
              class="btn btn-ghost"
              aria-label={`Edit ${exercise.name}`}
              onclick={() => openEdit(exercise)}
            >
              Edit
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              aria-label={`Delete ${exercise.name}`}
              onclick={() => void handleDelete(exercise)}
            >
              Delete
            </button>
          </div>
        {/if}
      </article>
    {/each}
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if !formOpen}
    <button
      type="button"
      class="btn btn-ghost"
      id="new-exercise-button"
      onclick={openCreate}
    >
      New exercise
    </button>
  {/if}
</div>
