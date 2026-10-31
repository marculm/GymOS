<script lang="ts">
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import type {
    CreateWorkoutSetInput,
    Exercise,
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
  } from "@gymos/shared";

  let {
    session,
    plan,
    exercises,
    onLogSet,
    onComplete,
  }: {
    session: WorkoutSessionDetail;
    plan: WorkoutPlan | null;
    exercises: Exercise[];
    onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
    onComplete: () => Promise<void>;
  } = $props();

  // svelte-ignore state_referenced_locally
  const initialExercise = plan?.exercises[0]?.exercise ?? exercises[0];

  let exerciseId = $state(initialExercise?.id ?? "");
  let weightKg = $state<string | number | null>(
    initialExercise?.defaultWeightKg ?? ""
  );
  let reps = $state<string | number | null>(initialExercise?.defaultReps ?? "");
  let rpe = $state<string | number | null>("");
  let pending = $state(false);
  let error = $state<string | null>(null);

  const completed = $derived(session.completedAt !== null);

  const selectableExercises = $derived(
    plan ? plan.exercises.map((entry) => entry.exercise) : exercises
  );

  function selectExercise(id: string) {
    exerciseId = id;
    const exercise = selectableExercises.find((entry) => entry.id === id);
    weightKg = exercise?.defaultWeightKg ?? "";
    reps = exercise?.defaultReps ?? "";
  }

  const setsByExercise = $derived.by(() => {
    const map = new Map<string, LoggedSet[]>();
    for (const set of session.sets) {
      const current = map.get(set.exerciseId) ?? [];
      current.push(set);
      map.set(set.exerciseId, current);
    }
    for (const sets of map.values()) {
      sets.sort((a, b) => a.setNumber - b.setNumber);
    }
    return map;
  });

  const planExerciseIds = $derived(
    new Set(plan?.exercises.map((entry) => entry.exercise.id) ?? [])
  );

  const setGroups = $derived.by(() => {
    const groups: Array<{
      exerciseId: string;
      name: string;
      sets: LoggedSet[];
    }> = [];

    for (const [exerciseId, sets] of setsByExercise) {
      if (planExerciseIds.has(exerciseId)) continue;
      const name = sets[0]?.exerciseName ?? "Unknown exercise";
      groups.push({ exerciseId, name, sets });
    }

    return groups;
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;

    pending = true;
    error = null;

    try {
      await onLogSet({
        exerciseId,
        weightKg: Number(weightKg),
        reps: Number(reps),
        rpe: rpe == null || rpe === "" ? undefined : Number(rpe),
      });
      weightKg = "";
      reps = "";
      rpe = "";
    } catch (logError) {
      error =
        logError instanceof Error ? logError.message : "Could not log the set";
    } finally {
      pending = false;
    }
  }

  async function handleComplete() {
    if (pending) return;

    pending = true;
    error = null;

    try {
      await onComplete();
    } catch (completeError) {
      error =
        completeError instanceof Error
          ? completeError.message
          : "Could not finish the workout";
    } finally {
      pending = false;
    }
  }
</script>

{#snippet setRow(set: LoggedSet)}
  <p class="set-row">
    <span class="badge">Set {set.setNumber}</span>
    <span>{set.reps} × {set.weightKg} kg</span>
    {#if set.rpe != null}
      <span class="muted">@ RPE {set.rpe}</span>
    {/if}
  </p>
{/snippet}

<div class="stack">
  <header class="card stack">
    <div>
      <p class="muted">{new Date(session.startedAt).toLocaleString()}</p>
      <h2 class="card-title">{session.title}</h2>
    </div>
    {#if !completed}
      <button
        type="button"
        class="btn btn-primary"
        disabled={pending}
        onclick={() => void handleComplete()}
      >
        Finish workout
      </button>
    {/if}
  </header>

  {#if plan}
    {#each plan.exercises as planExercise (planExercise.id)}
      <section class="card stack">
        <div>
          <h3 class="card-title">{planExercise.exercise.name}</h3>
          <p class="muted">
            {planExercise.targetSets} × {planExercise.targetReps}
            {planExercise.targetWeightKg != null
              ? ` @ ${planExercise.targetWeightKg} kg`
              : ""}
          </p>
        </div>
        {#if (setsByExercise.get(planExercise.exercise.id) ?? []).length === 0}
          <p class="muted">No sets yet</p>
        {:else}
          {#each setsByExercise.get(planExercise.exercise.id) ?? [] as set (set.id)}
            {@render setRow(set)}
          {/each}
        {/if}
      </section>
    {/each}
  {/if}

  {#if !plan && setsByExercise.size === 0}
    <p class="empty">No sets logged yet</p>
  {:else}
    {#each setGroups as group (group.exerciseId)}
      <section class="card stack">
        <h3 class="card-title">{group.name}</h3>
        {#each group.sets as set (set.id)}
          {@render setRow(set)}
        {/each}
      </section>
    {/each}
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if !completed}
    <form class="card stack" onsubmit={handleSubmit}>
      <h3 class="card-title">Log a set</h3>

      <fieldset class="stack" disabled={pending}>
        <label class="field">
          <span class="label">Exercise</span>
          <select
            class="input"
            required
            value={exerciseId}
            onchange={(event) => selectExercise(event.currentTarget.value)}
          >
            {#each selectableExercises as exercise (exercise.id)}
              <option value={exercise.id}>{exercise.name}</option>
            {/each}
          </select>
        </label>

        {#if selectableExercises.length === 0}
          <p class="muted">
            No exercises available. Add one in the exercise register.
          </p>
        {/if}

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

        <button
          type="submit"
          class="btn btn-primary"
          disabled={pending || selectableExercises.length === 0}
        >
          Log set
        </button>
      </fieldset>
    </form>
  {/if}
</div>
