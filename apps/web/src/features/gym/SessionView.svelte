<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import type {
    CreateExerciseInput,
    CreateWorkoutSetInput,
    Exercise,
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
  } from "@gymos/shared";
  import ExerciseForm from "./ExerciseForm.svelte";
  import { formatWeight } from "./format.mts";
  import SetLogForm from "./SetLogForm.svelte";

  let {
    session,
    plan,
    exercises,
    onLogSet,
    onDeleteSet,
    onUpdateExercise,
    onComplete,
  }: {
    session: WorkoutSessionDetail;
    plan: WorkoutPlan | null;
    exercises: Exercise[];
    onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
    onDeleteSet: (setId: string) => Promise<void>;
    onUpdateExercise: (id: string, input: CreateExerciseInput) => Promise<void>;
    onComplete: () => Promise<void>;
  } = $props();

  const REST_PRESETS: readonly number[] = [120, 150, 180];
  const DEFAULT_REST_PRESET = 120;
  const REST_PRESET_KEY = "gymos.restTimerSeconds";
  const SWIPE_DELETE_THRESHOLD = 60;
  const UNDO_WINDOW_MS = 5000;

  let freeExercises = $state<Exercise[]>([]);
  let manualExpanded = $state<Record<string, boolean>>({});
  let exerciseToAdd = $state("");
  let editingExerciseId = $state<string | null>(null);
  let pending = $state(false);
  let error = $state<string | null>(null);
  let finishButton = $state<HTMLButtonElement | null>(null);
  let timerPreset = $state(loadPreset());
  let remaining = $state(0);
  let timerRunning = $state(false);
  let showTimerOptions = $state(false);
  let hiddenSetIds = $state<Set<string>>(new Set());
  let pendingUndos = $state<LoggedSet[]>([]);
  const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let swipeStart: {
    pointerId: number;
    setId: string;
    x: number;
    y: number;
  } | null = null;

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
        name: byId.get(group.exerciseId)?.name ?? group.name,
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

  function isCardExpanded(exerciseId: string): boolean {
    return manualExpanded[exerciseId] ?? false;
  }

  function toggleCard(exerciseId: string, expanded: boolean) {
    manualExpanded = { ...manualExpanded, [exerciseId]: !expanded };
    if (expanded) editingExerciseId = null;
  }

  function startEditing(exerciseId: string) {
    editingExerciseId = exerciseId;
  }

  async function saveExercise(
    exerciseId: string,
    input: CreateExerciseInput
  ): Promise<void> {
    await onUpdateExercise(exerciseId, input);
    editingExerciseId = null;
    await tick();
    manualExpanded = { ...manualExpanded, [exerciseId]: true };
  }

  const doneState = new Map<string, boolean>();

  $effect(() => {
    for (const entry of plan?.exercises ?? []) {
      const exerciseId = entry.exercise.id;
      const done =
        visibleSets(setsByExercise.get(exerciseId) ?? []).length >=
        entry.targetSets;
      if (done && doneState.get(exerciseId) !== true) {
        manualExpanded = { ...manualExpanded, [exerciseId]: false };
      }
      doneState.set(exerciseId, done);
    }
  });

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

  function visibleSets(sets: LoggedSet[]): LoggedSet[] {
    return sets.filter((set) => !hiddenSetIds.has(set.id));
  }

  function scheduleDelete(set: LoggedSet) {
    if (completed || pending || deleteTimers.has(set.id)) return;
    error = null;
    hiddenSetIds = new Set(hiddenSetIds).add(set.id);
    pendingUndos = [...pendingUndos, set];
    deleteTimers.set(
      set.id,
      setTimeout(() => void flushDelete(set.id), UNDO_WINDOW_MS)
    );
  }

  async function flushDelete(setId: string): Promise<boolean> {
    const timer = deleteTimers.get(setId);
    if (!timer) return true;
    clearTimeout(timer);
    deleteTimers.delete(setId);
    pendingUndos = pendingUndos.filter((set) => set.id !== setId);

    try {
      await onDeleteSet(setId);
      return true;
    } catch (deleteError) {
      hiddenSetIds = new Set([...hiddenSetIds].filter((id) => id !== setId));
      error =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the set";
      return false;
    }
  }

  async function undoDelete(set: LoggedSet) {
    const timer = deleteTimers.get(set.id);
    if (!timer) return;
    clearTimeout(timer);
    deleteTimers.delete(set.id);
    pendingUndos = pendingUndos.filter((entry) => entry.id !== set.id);
    hiddenSetIds = new Set([...hiddenSetIds].filter((id) => id !== set.id));
    await tick();
    manualExpanded = { ...manualExpanded, [set.exerciseId]: true };
  }

  async function flushPendingDeletes(): Promise<boolean> {
    const results = await Promise.all(
      [...deleteTimers.keys()].map((setId) => flushDelete(setId))
    );
    return results.every(Boolean);
  }

  onDestroy(() => void flushPendingDeletes());

  function startSwipe(event: PointerEvent, set: LoggedSet) {
    if (completed || pending || event.button !== 0) return;
    swipeStart = {
      pointerId: event.pointerId,
      setId: set.id,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function endSwipe(event: PointerEvent, set: LoggedSet) {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const start = swipeStart;
    swipeStart = null;
    if (set.id !== start.setId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dx <= -SWIPE_DELETE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      scheduleDelete(set);
    }
  }

  function cancelSwipe() {
    swipeStart = null;
  }

  async function handleComplete() {
    if (pending) return;

    pending = true;
    error = null;
    let failed = false;

    try {
      if (await flushPendingDeletes()) {
        await onComplete();
      } else {
        failed = true;
      }
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
  <div
    class="set-row"
    role="group"
    onpointerdown={(event) => startSwipe(event, set)}
    onpointerup={(event) => endSwipe(event, set)}
    onpointercancel={cancelSwipe}
  >
    <span class="badge">Set {set.setNumber}</span>
    <span class="grow">{set.reps} × {formatWeight(set.weightKg)} kg</span>
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

{#snippet cardHeader(
  exerciseId: string,
  name: string,
  expanded: boolean,
  done: boolean
)}
  <h3 class="card-title card-heading">
    <button
      type="button"
      class="card-toggle"
      aria-expanded={expanded}
      aria-controls={`sets-${exerciseId}`}
      aria-describedby={done ? `done-${exerciseId}` : undefined}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
      onclick={() => toggleCard(exerciseId, expanded)}
    >
      <span>{name}</span>
      {#if done}
        <span class="badge" id={`done-${exerciseId}`}>Done</span>
      {/if}
    </button>
  </h3>
{/snippet}

{#snippet exerciseEdit(exerciseId: string, exercise: Exercise)}
  {#if editingExerciseId === exerciseId}
    <ExerciseForm
      exercise={exercise}
      onSubmit={(input) => saveExercise(exerciseId, input)}
      onCancel={() => (editingExerciseId = null)}
    />
  {:else}
    <button
      type="button"
      class="btn btn-ghost"
      disabled={pending}
      aria-label={`Edit exercise ${exercise.name}`}
      onclick={() => startEditing(exerciseId)}
    >
      Edit exercise
    </button>
  {/if}
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
    {#if editingExerciseId !== exerciseId}
      <SetLogForm
        exercise={exercise}
        disabled={pending}
        onSubmit={(input) => logSet(exerciseId, input)}
      />
    {/if}
    {@render exerciseEdit(exerciseId, exercise)}
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
      {@const exerciseId = planExercise.exercise.id}
      {@const sets = visibleSets(setsByExercise.get(exerciseId) ?? [])}
      {@const done = sets.length >= planExercise.targetSets}
      {@const expanded = isCardExpanded(exerciseId)}
      <section class="card stack" class:exercise-done={done}>
        {@render cardHeader(
          exerciseId,
          planExercise.exercise.name,
          expanded,
          done
        )}
        <div class="stack" id={`sets-${exerciseId}`}>
          {#if expanded}
            <p class="muted">
              {planExercise.targetSets} × {planExercise.targetReps}
              {planExercise.targetWeightKg != null
                ? ` @ ${formatWeight(planExercise.targetWeightKg)} kg`
                : ""}
            </p>
            {@render setRowsAndForm(exerciseId, sets, planExercise.exercise)}
          {/if}
        </div>
      </section>
    {/each}

    {#each setGroups as group (group.exerciseId)}
      {@const expanded = isCardExpanded(group.exerciseId)}
      {@const exercise =
        exercises.find((entry) => entry.id === group.exerciseId) ?? null}
      <section class="card stack">
        {@render cardHeader(
          group.exerciseId,
          exercise?.name ?? group.name,
          expanded,
          false
        )}
        <div class="stack" id={`sets-${group.exerciseId}`}>
          {#if expanded}
            {#each visibleSets(group.sets) as set (set.id)}
              {@render setRow(set)}
            {/each}
            {#if !completed && exercise}
              {@render exerciseEdit(group.exerciseId, exercise)}
            {/if}
          {/if}
        </div>
      </section>
    {/each}
  {:else}
    {#if freeCards.length === 0}
      <p class="empty">No sets logged yet</p>
    {/if}

    {#each freeCards as card (card.exerciseId)}
      {@const expanded = isCardExpanded(card.exerciseId)}
      <section class="card stack">
        {@render cardHeader(card.exerciseId, card.name, expanded, false)}
        <div class="stack" id={`sets-${card.exerciseId}`}>
          {#if expanded}
            {@render setRowsAndForm(
              card.exerciseId,
              visibleSets(card.sets),
              card.exercise
            )}
          {/if}
        </div>
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

    {#if pendingUndos.length > 0}
      <div class="stack" role="status" aria-live="polite">
        {#each pendingUndos as set (set.id)}
          {@const current =
            session.sets.find((entry) => entry.id === set.id) ?? set}
          <p class="muted">
            Deleted set {current.setNumber} for {current.exerciseName}.
            <button
              type="button"
              class="btn btn-ghost"
              aria-label={`Undo deleting set ${current.setNumber} for ${current.exerciseName}`}
              onclick={() => void undoDelete(set)}
            >
              Undo
            </button>
          </p>
        {/each}
      </div>
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
