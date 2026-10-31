<script lang="ts">
  import type {
    CreateWorkoutSetInput,
    Exercise,
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
  } from "@gymos/shared";
  import SetLogForm from "./SetLogForm.svelte";

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

  let freeExercises = $state<Exercise[]>([]);
  let exerciseToAdd = $state("");
  let pending = $state(false);
  let error = $state<string | null>(null);

  const completed = $derived(session.completedAt !== null);

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

  const freeCards = $derived.by(() => {
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const cards = new Map<
      string,
      {
        exerciseId: string;
        name: string;
        sets: LoggedSet[];
        exercise: Exercise | null;
      }
    >();

    for (const exercise of freeExercises) {
      cards.set(exercise.id, {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: setsByExercise.get(exercise.id) ?? [],
        exercise,
      });
    }

    for (const group of setGroups) {
      if (cards.has(group.exerciseId)) continue;
      cards.set(group.exerciseId, {
        exerciseId: group.exerciseId,
        name: group.name,
        sets: group.sets,
        exercise: byId.get(group.exerciseId) ?? null,
      });
    }

    return [...cards.values()];
  });

  const addableExercises = $derived(
    exercises.filter(
      (exercise) => !freeCards.some((card) => card.exerciseId === exercise.id)
    )
  );

  function addExercise() {
    const exercise = addableExercises.find(
      (entry) => entry.id === exerciseToAdd
    );
    if (!exercise) return;
    freeExercises = [...freeExercises, exercise];
    exerciseToAdd = "";
  }

  async function logSet(
    exerciseId: string,
    input: Omit<CreateWorkoutSetInput, "exerciseId">
  ): Promise<boolean> {
    if (pending) return false;

    pending = true;
    try {
      await onLogSet({ exerciseId, ...input });
      return true;
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

{#snippet setRowsAndForm(
  exerciseId: string,
  sets: LoggedSet[],
  exercise: Exercise | null
)}
  {#if sets.length === 0}
    <p class="muted">No sets yet</p>
  {:else}
    {#each sets as set (set.id)}
      {@render setRow(set)}
    {/each}
  {/if}
  {#if !completed && exercise}
    <SetLogForm
      exercise={exercise}
      disabled={pending}
      onSubmit={(input) => logSet(exerciseId, input)}
    />
  {/if}
{/snippet}

<div class="stack">
  <header class="card stack">
    <div>
      <p class="muted">{new Date(session.startedAt).toLocaleString()}</p>
      <h2 class="card-title">{session.title}</h2>
    </div>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
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
        {@render setRowsAndForm(
          planExercise.exercise.id,
          setsByExercise.get(planExercise.exercise.id) ?? [],
          planExercise.exercise
        )}
      </section>
    {/each}

    {#each setGroups as group (group.exerciseId)}
      <section class="card stack">
        <h3 class="card-title">{group.name}</h3>
        {#each group.sets as set (set.id)}
          {@render setRow(set)}
        {/each}
      </section>
    {/each}
  {:else}
    {#if freeCards.length === 0}
      <p class="empty">No sets logged yet</p>
    {/if}

    {#each freeCards as card (card.exerciseId)}
      <section class="card stack">
        <h3 class="card-title">{card.name}</h3>
        {@render setRowsAndForm(card.exerciseId, card.sets, card.exercise)}
      </section>
    {/each}

    {#if !completed}
      <section class="card stack">
        <h3 class="card-title">Add exercise</h3>
        <div class="row">
          <label class="field grow">
            <span class="label">Exercise</span>
            <select
              class="input"
              value={exerciseToAdd}
              disabled={pending}
              onchange={(event) => (exerciseToAdd = event.currentTarget.value)}
            >
              <option value="">Choose an exercise</option>
              {#each addableExercises as exercise (exercise.id)}
                <option value={exercise.id}>{exercise.name}</option>
              {/each}
            </select>
          </label>
          <button
            type="button"
            class="btn btn-primary"
            disabled={pending || !exerciseToAdd}
            onclick={addExercise}
          >
            Add exercise
          </button>
        </div>
        {#if exercises.length === 0}
          <p class="muted">
            No exercises available. Add one in the exercise register.
          </p>
        {/if}
      </section>
    {/if}
  {/if}
</div>
