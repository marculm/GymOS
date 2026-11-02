<script lang="ts">
  import { tick } from "svelte";
  import type {
    CreateWorkoutSetInput,
    Exercise,
    LoggedSet,
    WeightSuggestions,
    WorkoutPlan,
    WorkoutSessionDetail,
  } from "@gymos/shared";
  import SetLogForm from "./SetLogForm.svelte";

  let {
    session,
    plan,
    exercises,
    weightSuggestions = {},
    onLogSet,
    onDeleteSet,
    onComplete,
  }: {
    session: WorkoutSessionDetail;
    plan: WorkoutPlan | null;
    exercises: Exercise[];
    weightSuggestions?: WeightSuggestions;
    onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
    onDeleteSet: (setId: string) => Promise<void>;
    onComplete: () => Promise<void>;
  } = $props();

  const REST_PRESETS: readonly number[] = [120, 150, 180];
  const DEFAULT_REST_PRESET = 120;
  const REST_PRESET_KEY = "gymos.restTimerSeconds";

  let freeExercises = $state<Exercise[]>([]);
  let exerciseToAdd = $state("");
  let pending = $state(false);
  let error = $state<string | null>(null);
  let finishButton = $state<HTMLButtonElement | null>(null);
  let timerPreset = $state(loadPreset());
  let remaining = $state(0);
  let timerRunning = $state(false);
  let showTimerOptions = $state(false);

  function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function presetStorage(): Storage | null {
    try {
      return window.localStorage ?? window.sessionStorage;
    } catch {
      return null;
    }
  }

  function loadPreset(): number {
    try {
      const stored = Number(presetStorage()?.getItem(REST_PRESET_KEY));
      return REST_PRESETS.includes(stored) ? stored : DEFAULT_REST_PRESET;
    } catch {
      return DEFAULT_REST_PRESET;
    }
  }

  function startTimer() {
    remaining = timerPreset;
    timerRunning = true;
  }

  function selectPreset(preset: number) {
    timerPreset = preset;
    try {
      presetStorage()?.setItem(REST_PRESET_KEY, String(preset));
    } catch {
      // Remembering the preset is best-effort; the timer still runs.
    }
    startTimer();
  }

  function toggleTimer() {
    if (timerRunning) {
      remaining = 0;
      timerRunning = false;
    } else {
      startTimer();
    }
  }

  $effect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (remaining === 0) timerRunning = false;
    }, 1000);
    return () => clearInterval(id);
  });

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
      startTimer();
      return true;
    } finally {
      pending = false;
    }
  }

  async function deleteSet(set: LoggedSet) {
    if (pending) return;
    if (!confirm(`Delete set ${set.setNumber} for ${set.exerciseName}?`)) {
      return;
    }

    pending = true;
    error = null;

    try {
      await onDeleteSet(set.id);
    } catch (deleteError) {
      error =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the set";
    } finally {
      pending = false;
    }
  }

  async function handleComplete() {
    if (pending) return;

    pending = true;
    error = null;
    let failed = false;

    try {
      await onComplete();
    } catch (completeError) {
      failed = true;
      error =
        completeError instanceof Error
          ? completeError.message
          : "Could not finish the workout";
    } finally {
      pending = false;
    }

    if (failed) {
      await tick();
      finishButton?.focus();
    }
  }
</script>

{#snippet setRow(set: LoggedSet)}
  <div class="set-row">
    <span class="badge">Set {set.setNumber}</span>
    <span class="grow">{set.reps} × {set.weightKg} kg</span>
    {#if !completed}
      <button
        type="button"
        class="btn btn-ghost set-delete"
        disabled={pending}
        aria-label={`Delete set ${set.setNumber} for ${set.exerciseName}`}
        onclick={() => void deleteSet(set)}
      >
        Delete
      </button>
    {/if}
  </div>
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
      suggestedWeightKg={weightSuggestions[exerciseId]}
      disabled={pending}
      onSubmit={(input) => logSet(exerciseId, input)}
    />
  {/if}
{/snippet}

<div class="stack">
  <header class="card stack">
    <div>
      <p class="muted">{new Date(session.startedAt).toLocaleString()}</p>
      <h2 class="card-title" id="session-heading" tabindex="-1">
        {session.title}
      </h2>
    </div>
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

{#if !completed}
  <div class="session-bar" role="region" aria-label="Workout controls">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <div id="rest-timer-options" hidden={!showTimerOptions}>
      <div class="row">
        {#each REST_PRESETS as preset (preset)}
          <button
            type="button"
            class="btn btn-ghost timer-preset"
            aria-pressed={preset === timerPreset}
            onclick={() => selectPreset(preset)}
          >
            {formatTime(preset)}
          </button>
        {/each}
        <button type="button" class="btn btn-ghost" onclick={toggleTimer}>
          {timerRunning ? "Stop" : "Reset"}
        </button>
      </div>
    </div>

    <div class="row">
      <button
        type="button"
        class="btn btn-ghost session-timer"
        aria-label={`Rest timer ${formatTime(remaining)}`}
        aria-expanded={showTimerOptions}
        aria-controls="rest-timer-options"
        onclick={() => (showTimerOptions = !showTimerOptions)}
      >
        {formatTime(remaining)}
      </button>
      <button
        bind:this={finishButton}
        type="button"
        class="btn btn-primary grow"
        disabled={pending}
        onclick={() => void handleComplete()}
      >
        Finish workout
      </button>
    </div>
  </div>
{/if}
