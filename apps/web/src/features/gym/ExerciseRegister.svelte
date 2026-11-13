<script lang="ts">
  import { tick } from "svelte";
  import { Pencil, Plus, Trash2 } from "lucide-svelte";
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
    onCreate: (input: CreateExerciseInput) => Promise<Exercise>;
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

  async function close(focusId: string) {
    formOpen = false;
    editingExercise = null;
    await tick();
    document.getElementById(focusId)?.focus();
  }

  function cancel() {
    void close(
      editingExercise
        ? `edit-exercise-${editingExercise.id}`
        : "new-exercise-button"
    );
  }

  async function handleSubmit(input: CreateExerciseInput) {
    if (editingExercise) {
      const exerciseId = editingExercise.id;
      await onUpdate(exerciseId, input);
      await close(`edit-exercise-${exerciseId}`);
      return;
    }
    const created = await onCreate(input);
    await close(`edit-exercise-${created.id}`);
  }

  async function handleDelete(exercise: Exercise) {
    if (!confirm(`Delete ${exercise.name}? Past workouts keep their records.`)) {
      return;
    }

    error = null;
    try {
      await onDelete(exercise.id);
    } catch (deleteError) {
      error =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the exercise";
    }
  }
</script>

<div class="section">
  <div class="section-header">
    <span>Exercise library</span>
    <span>{exercises.length}</span>
  </div>

  <div class="group exercises-group">
    {#if formOpen && !editingExercise}
      <div class="group-form">
        <ExerciseForm onSubmit={handleSubmit} onCancel={cancel} />
      </div>
    {/if}

    {#each exercises as exercise (exercise.id)}
      {#if editingExercise?.id === exercise.id}
        <div class="group-form">
          <ExerciseForm
            exercise={editingExercise}
            onSubmit={handleSubmit}
            onCancel={cancel}
          />
        </div>
      {:else}
        <div class="list-row">
          <div class="list-main">
            <h3 class="list-title">{exercise.name}</h3>
            <span class="list-subtitle">
              {exercise.muscleGroup} · {exercise.defaultSets} × {exercise.defaultReps}{exercise.defaultWeightKg !=
              null
                ? ` @ ${formatWeight(exercise.defaultWeightKg)} kg`
                : ""}
            </span>
          </div>
          <div class="list-actions">
            <button
              type="button"
              class="icon-btn muted"
              id={`edit-exercise-${exercise.id}`}
              aria-label={`Edit ${exercise.name}`}
              onclick={() => openEdit(exercise)}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-btn muted"
              aria-label={`Delete ${exercise.name}`}
              onclick={() => void handleDelete(exercise)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      {/if}
    {/each}

    {#if !formOpen}
      <button
        type="button"
        class="list-row add-row"
        id="new-exercise-button"
        onclick={openCreate}
      >
        <Plus size={18} aria-hidden="true" />
        New exercise
      </button>
    {/if}
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</div>
