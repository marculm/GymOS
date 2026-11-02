<script lang="ts">
  import { MUSCLE_GROUPS } from "@gymos/shared";
  import type { CreateExerciseInput, Exercise } from "@gymos/shared";
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

  let editingId = $state<string | null>(null);
  let formOpen = $state(false);
  let name = $state("");
  let muscleGroup = $state<Exercise["muscleGroup"]>("chest");
  let description = $state("");
  let defaultSets = $state<number | string>(3);
  let defaultReps = $state<number | string>(8);
  let defaultWeightKg = $state<number | string>("");
  let pending = $state(false);
  let error = $state<string | null>(null);

  function openCreate() {
    editingId = null;
    name = "";
    muscleGroup = "chest";
    description = "";
    defaultSets = 3;
    defaultReps = 8;
    defaultWeightKg = "";
    error = null;
    formOpen = true;
  }

  function openEdit(exercise: Exercise) {
    editingId = exercise.id;
    name = exercise.name;
    muscleGroup = exercise.muscleGroup;
    description = exercise.description ?? "";
    defaultSets = exercise.defaultSets;
    defaultReps = exercise.defaultReps;
    defaultWeightKg = exercise.defaultWeightKg ?? "";
    error = null;
    formOpen = true;
  }

  function close() {
    formOpen = false;
    editingId = null;
  }

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
      if (editingId) {
        await onUpdate(editingId, input);
      } else {
        await onCreate(input);
      }
      close();
    } catch (submitError) {
      error =
        submitError instanceof Error
          ? submitError.message
          : "Could not save the exercise";
    } finally {
      pending = false;
    }
  }

  async function handleDelete(exercise: Exercise) {
    if (!confirm(`Delete ${exercise.name}? Past workouts keep their records.`)) {
      return;
    }

    error = null;
    try {
      await onDelete(exercise.id);
      if (editingId === exercise.id) close();
    } catch (deleteError) {
      error =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the exercise";
    }
  }
</script>

<div class="stack">
  {#each exercises as exercise (exercise.id)}
    <article class="card stack">
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
    </article>
  {/each}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if formOpen}
    <form class="card stack" onsubmit={handleSubmit}>
      <h3 class="card-title">
        {editingId ? "Edit exercise" : "New exercise"}
      </h3>

      <label class="field">
        <span class="label">Name</span>
        <input class="input" required maxlength={100} bind:value={name} />
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

      <div class="row">
        <label class="field grow">
          <span class="label">Default sets</span>
          <input
            class="input"
            type="number"
            min={1}
            max={20}
            required
            bind:value={defaultSets}
          />
        </label>
        <label class="field grow">
          <span class="label">Default reps</span>
          <input
            class="input"
            type="number"
            min={1}
            max={100}
            required
            bind:value={defaultReps}
          />
        </label>
        <label class="field grow">
          <span class="label">Default weight (kg, optional)</span>
          <input
            class="input"
            type="number"
            min={0}
            step={0.01}
            value={defaultWeightKg}
            oninput={(event) =>
              (defaultWeightKg =
                event.currentTarget.value === ""
                  ? ""
                  : Number(event.currentTarget.value))}
          />
        </label>
      </div>

      <label class="field">
        <span class="label">Description (optional)</span>
        <input class="input" maxlength={500} bind:value={description} />
      </label>

      <div class="row">
        <button type="button" class="btn btn-ghost" onclick={close}>
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={pending || name.trim().length === 0}
        >
          Save exercise
        </button>
      </div>
    </form>
  {:else}
    <button type="button" class="btn btn-ghost" onclick={openCreate}>
      New exercise
    </button>
  {/if}
</div>
