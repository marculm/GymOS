<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    Check,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    Minus,
    Plus,
    Trash2,
  } from "lucide-svelte";
  import type {
    CreateExerciseInput,
    CreateWorkoutSetInput,
    Exercise,
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
  } from "@gymos/shared";
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import {
    formatRestTime,
    loadRestSeconds,
    REST_PRESETS,
    saveRestSeconds,
  } from "$lib/rest-timer.ts";
  import { syncRestTimer } from "../../push.mts";
  import ExerciseForm from "./ExerciseForm.svelte";
  import { formatWeight } from "./format.mts";
  import SessionSheet from "./SessionSheet.svelte";

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

  type SessionPage = {
    exerciseId: string;
    name: string;
    exercise: Exercise | null;
    targetSets: number;
    targetReps: number;
    targetWeightKg: number | null;
    notes: string | null;
    sets: LoggedSet[];
  };

  const REST_END_KEY = "gymos.restTimerEndsAt";

  let index = $state(0);
  let drafts = $state<Record<string, { reps: number; weightKg: number }>>({});
  let pending = $state(false);
  let error = $state<string | null>(null);
  let finishing = $state(false);
  let editing = $state<"reps" | "weight" | null>(null);
  let editValue = $state<string | number>("");
  let editInput = $state<HTMLInputElement | null>(null);
  let freeExercises = $state<Exercise[]>([]);
  let exerciseToAdd = $state("");
  let showSwitcher = $state(false);
  let setsOpen = $state(false);
  let showTimer = $state(false);
  let showEditExercise = $state(false);
  let deleteTarget = $state<string | null>(null);
  let deleteError = $state<string | null>(null);
  let swipeStart: { x: number; y: number; pointerId: number } | null = null;
  const pendingSetKeys = new Map<string, string>();

  let timerPreset = $state(loadRestSeconds());
  const initialEnd = loadEnd();
  const initialRemaining = remainingFrom(initialEnd);
  let endsAt = initialEnd;
  let remaining = $state(initialRemaining);
  let timerRunning = $state(initialRemaining > 0);

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  function presetStorage(): Storage | null {
    try {
      return window.localStorage ?? window.sessionStorage;
    } catch {
      return null;
    }
  }

  function loadEnd(): number | null {
    try {
      const stored = presetStorage()?.getItem(REST_END_KEY);
      const end = Number(stored);
      return stored != null && Number.isFinite(end) && end > 0 ? end : null;
    } catch {
      return null;
    }
  }

  function remainingFrom(end: number | null): number {
    return end === null
      ? 0
      : Math.max(0, Math.ceil((end - Date.now()) / 1000));
  }

  function storeEnd(end: number | null) {
    try {
      if (end === null) presetStorage()?.removeItem(REST_END_KEY);
      else presetStorage()?.setItem(REST_END_KEY, String(end));
    } catch {
      // Restoring the timer is best-effort; the countdown still runs.
    }
  }

  function startTimer() {
    endsAt = Date.now() + timerPreset * 1000;
    remaining = timerPreset;
    timerRunning = true;
    storeEnd(endsAt);
    void syncRestTimer(endsAt);
  }

  function clearTimer() {
    remaining = 0;
    timerRunning = false;
    endsAt = null;
    storeEnd(null);
  }

  function stopTimer() {
    clearTimer();
    void syncRestTimer(null);
  }

  function selectPreset(seconds: number) {
    timerPreset = seconds;
    saveRestSeconds(seconds);
    startTimer();
    showTimer = false;
  }

  $effect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      remaining = remainingFrom(endsAt);
      if (remaining === 0) clearTimer();
    }, 1000);
    return () => clearInterval(id);
  });

  onMount(() => {
    if (!timerRunning) storeEnd(null);
  });

  const pages = $derived.by<SessionPage[]>(() => {
    const byExercise = new Map<string, LoggedSet[]>();
    for (const set of session.sets) {
      const current = byExercise.get(set.exerciseId) ?? [];
      current.push(set);
      byExercise.set(set.exerciseId, current);
    }
    for (const sets of byExercise.values()) {
      sets.sort((a, b) => a.setNumber - b.setNumber);
    }

    const result: SessionPage[] = [];
    const seen = new Set<string>();

    if (plan) {
      for (const entry of plan.exercises) {
        const exerciseId = entry.exercise.id;
        seen.add(exerciseId);
        result.push({
          exerciseId,
          name: entry.exercise.name,
          exercise: entry.exercise,
          targetSets: entry.targetSets,
          targetReps: entry.targetReps,
          targetWeightKg: entry.targetWeightKg,
          notes: entry.notes,
          sets: byExercise.get(exerciseId) ?? [],
        });
      }
    }

    for (const [exerciseId, sets] of byExercise) {
      if (seen.has(exerciseId)) continue;
      const exercise = exercises.find((entry) => entry.id === exerciseId) ?? null;
      const last = sets[sets.length - 1];
      result.push({
        exerciseId,
        name: exercise?.name ?? sets[0]?.exerciseName ?? "Exercise",
        exercise,
        targetSets: exercise?.defaultSets ?? Math.max(sets.length, 1),
        targetReps: exercise?.defaultReps ?? last?.reps ?? 8,
        targetWeightKg: exercise?.defaultWeightKg ?? last?.weightKg ?? null,
        notes: null,
        sets,
      });
    }

    for (const free of freeExercises) {
      if (seen.has(free.id) || byExercise.has(free.id)) continue;
      result.push({
        exerciseId: free.id,
        name: free.name,
        exercise: free,
        targetSets: free.defaultSets,
        targetReps: free.defaultReps,
        targetWeightKg: free.defaultWeightKg,
        notes: null,
        sets: [],
      });
    }

    return result;
  });

  const current = $derived(
    pages[Math.min(index, Math.max(pages.length - 1, 0))] ?? null
  );
  const draft = $derived(
    current ? draftFor(current) : { reps: 1, weightKg: 0 }
  );
  const addableExercises = $derived(
    exercises.filter(
      (exercise) => !pages.some((page) => page.exerciseId === exercise.id)
    )
  );

  $effect(() => {
    const max = Math.max(pages.length - 1, 0);
    if (index > max) index = max;
  });

  function draftFor(page: SessionPage) {
    const stored = drafts[page.exerciseId];
    if (stored) return stored;
    const last = page.sets[page.sets.length - 1];
    return {
      reps: last?.reps ?? page.targetReps,
      weightKg: last?.weightKg ?? page.targetWeightKg ?? 0,
    };
  }

  function isDone(page: SessionPage): boolean {
    return page.sets.length >= page.targetSets;
  }

  function dotIndices(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function setDraft(kind: "reps" | "weightKg", value: number) {
    if (!current) return;
    drafts = {
      ...drafts,
      [current.exerciseId]: { ...draft, [kind]: value },
    };
  }

  function adjustReps(delta: number) {
    setDraft("reps", clamp(Math.round(draft.reps + delta), 1, MAX_SET_REPS));
  }

  function adjustWeight(delta: number) {
    const next = Math.round((draft.weightKg + delta) * 100) / 100;
    setDraft("weightKg", clamp(next, 0, MAX_SET_WEIGHT_KG));
  }

  async function beginEdit(kind: "reps" | "weight") {
    editing = kind;
    editValue = String(draft[kind === "weight" ? "weightKg" : "reps"]);
    await tick();
    editInput?.focus();
    editInput?.select();
  }

  function commitEdit() {
    if (!editing) return;
    const parsed = Number(String(editValue).replace(",", "."));
    if (Number.isFinite(parsed)) {
      if (editing === "reps") {
        setDraft("reps", clamp(Math.round(parsed), 1, MAX_SET_REPS));
      } else {
        setDraft("weightKg", clamp(parsed, 0, MAX_SET_WEIGHT_KG));
      }
    }
    editing = null;
  }

  function cancelEdit() {
    editing = null;
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  async function logSet() {
    if (!current || pending) return;
    pending = true;
    error = null;

    try {
      const idempotencyKey =
        pendingSetKeys.get(current.exerciseId) ?? crypto.randomUUID();
      pendingSetKeys.set(current.exerciseId, idempotencyKey);
      await onLogSet({
        exerciseId: current.exerciseId,
        reps: draft.reps,
        weightKg: draft.weightKg,
        idempotencyKey,
      });
      pendingSetKeys.delete(current.exerciseId);
      drafts = {
        ...drafts,
        [current.exerciseId]: { reps: draft.reps, weightKg: draft.weightKg },
      };
      editing = null;
      startTimer();
    } catch (logError) {
      error = messageOf(logError);
    } finally {
      pending = false;
    }
  }

  async function goToPage(nextIndex: number, focus = true) {
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    index = nextIndex;
    editing = null;
    setsOpen = false;
    deleteTarget = null;
    deleteError = null;
    if (focus) {
      await tick();
      document.getElementById("session-focus")?.focus();
    }
  }

  function startSwipe(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function endSwipe(event: PointerEvent) {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) void goToPage(index + 1);
    else void goToPage(index - 1);
  }

  function cancelSwipe() {
    swipeStart = null;
  }

  function toggleSets() {
    setsOpen = !setsOpen;
    deleteTarget = null;
    deleteError = null;
  }

  async function removeSet(set: LoggedSet) {
    if (pending) return;
    pending = true;
    deleteError = null;
    try {
      await onDeleteSet(set.id);
      deleteTarget = null;
    } catch (removeError) {
      deleteError = messageOf(removeError);
    } finally {
      pending = false;
    }
  }

  function selectPage(pageIndex: number) {
    showSwitcher = false;
    void goToPage(pageIndex);
  }

  async function addExercise() {
    const exercise = addableExercises.find(
      (entry) => entry.id === exerciseToAdd
    );
    if (!exercise) return;
    freeExercises = [...freeExercises, exercise];
    exerciseToAdd = "";
    await tick();
    showSwitcher = false;
    await goToPage(pages.length - 1);
  }

  function openEditExercise() {
    if (!current?.exercise) return;
    showSwitcher = false;
    showEditExercise = true;
  }

  async function saveExercise(input: CreateExerciseInput) {
    if (!current?.exercise) return;
    await onUpdateExercise(current.exercise.id, input);
    showEditExercise = false;
  }

  async function finish() {
    if (finishing || pending) return;
    finishing = true;
    error = null;
    try {
      await onComplete();
      stopTimer();
    } catch (finishError) {
      error = messageOf(finishError);
    } finally {
      finishing = false;
    }
  }

  function finishFromSwitcher() {
    showSwitcher = false;
    void finish();
  }
</script>

<div class="session-screen">
  <header class="focus-top">
    <button
      type="button"
      class="timer-pill"
      class:running={timerRunning}
      aria-label={
        timerRunning
          ? `Rest timer running, ${formatRestTime(remaining)}`
          : `Rest timer, ${formatRestTime(timerPreset)}`
      }
      onclick={() => (showTimer = true)}
    >
      <span class="timer-dot" aria-hidden="true"></span>
      {formatRestTime(timerRunning ? remaining : timerPreset)}
    </button>
    <div class="focus-top-actions">
      <button
        type="button"
        class="finish-action"
        disabled={pending || finishing}
        onclick={() => void finish()}
      >
        {finishing ? "Finishing…" : "Finish"}
      </button>
      <button
        type="button"
        class="icon-btn muted"
        aria-label="Choose exercise"
        onclick={() => (showSwitcher = true)}
      >
        <LayoutGrid size={20} aria-hidden="true" />
      </button>
    </div>
  </header>

  <div class="exercise-progress" aria-hidden="true">
    {#each pages as page, pageIndex (page.exerciseId)}
      <span
        class:done={isDone(page)}
        class:current={pageIndex === index}
      ></span>
    {/each}
  </div>

  {#if error}
    <p class="error focus-alert" role="alert">{error}</p>
  {/if}

  {#if pages.length === 0}
    <div class="focus-empty">
      <p class="focus-eyebrow">Free workout</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <h1 class="focus-title" id="session-focus" tabindex="-1">
        No exercises yet
      </h1>
      <p class="focus-last">Add an exercise to start logging sets.</p>
      <div class="grow"></div>
      <button
        type="button"
        class="focus-primary"
        onclick={() => (showSwitcher = true)}
      >
        Add exercise
      </button>
    </div>
  {:else}
    <div
      class="focus-pager"
      role="group"
      aria-label="Workout exercises"
      onpointerdown={startSwipe}
      onpointerup={endSwipe}
      onpointercancel={cancelSwipe}
    >
      <div
        class="focus-track"
        style={`transform: translateX(-${index * 100}%)`}
      >
        {#each pages as page, pageIndex (page.exerciseId)}
          {@const pageDraft = draftFor(page)}
          {@const active = pageIndex === index}
          {@const done = isDone(page)}
          <section
            class="focus-page"
            aria-hidden={!active}
            inert={!active}
            aria-label={`Exercise ${pageIndex + 1} of ${pages.length}: ${page.name}`}
          >
            <p class="focus-eyebrow">Exercise {pageIndex + 1} of {pages.length}</p>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <h1
              class="focus-title"
              id={active ? "session-focus" : undefined}
              tabindex={active ? -1 : undefined}
            >
              {page.name}
            </h1>
            {#if page.notes}
              <p class="focus-notes">{page.notes}</p>
            {/if}
            <p class="focus-last">
              Last time · {page.targetSets} × {page.targetReps}{page.targetWeightKg !=
              null
                ? ` @ ${formatWeight(page.targetWeightKg)} kg`
                : ""}
            </p>

            <div class="focus-metrics">
              <div class="focus-metric">
                <span class="focus-metric-label">Reps</span>
                <div class="focus-metric-value">
                  {#if active && editing === "reps"}
                    <input
                      bind:this={editInput}
                      class="metric-input"
                      type="number"
                      inputmode="numeric"
                      min={1}
                      max={MAX_SET_REPS}
                      step={1}
                      bind:value={editValue}
                      onblur={commitEdit}
                      onkeydown={handleEditKeydown}
                    />
                  {:else}
                    <button
                      type="button"
                      class="metric-value"
                      aria-label={`Edit reps, current ${pageDraft.reps}`}
                      disabled={!active}
                      onclick={() => void beginEdit("reps")}
                    >
                      {pageDraft.reps}
                    </button>
                  {/if}
                </div>
                <div class="focus-metric-steps">
                  <button
                    type="button"
                    class="step-btn"
                    aria-label="Decrease reps"
                    disabled={!active || pending}
                    onclick={() => adjustReps(-1)}
                  >
                    <Minus size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="step-btn"
                    aria-label="Increase reps"
                    disabled={!active || pending}
                    onclick={() => adjustReps(1)}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div class="focus-metric">
                <span class="focus-metric-label">Weight</span>
                <div class="focus-metric-value">
                  {#if active && editing === "weight"}
                    <input
                      bind:this={editInput}
                      class="metric-input"
                      type="number"
                      inputmode="decimal"
                      min={0}
                      max={MAX_SET_WEIGHT_KG}
                      step={0.01}
                      bind:value={editValue}
                      onblur={commitEdit}
                      onkeydown={handleEditKeydown}
                    />
                  {:else}
                    <button
                      type="button"
                      class="metric-value"
                      aria-label={`Edit weight, current ${pageDraft.weightKg} kg`}
                      disabled={!active}
                      onclick={() => void beginEdit("weight")}
                    >
                      {formatWeight(pageDraft.weightKg)}
                    </button>
                  {/if}
                </div>
                <div class="focus-metric-steps">
                  <button
                    type="button"
                    class="step-btn"
                    aria-label="Decrease weight"
                    disabled={!active || pending}
                    onclick={() => adjustWeight(-2.5)}
                  >
                    <Minus size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="step-btn"
                    aria-label="Increase weight"
                    disabled={!active || pending}
                    onclick={() => adjustWeight(2.5)}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="focus-sets"
              disabled={!active}
              aria-expanded={active ? setsOpen : false}
              aria-controls={active ? "focus-sets-panel" : undefined}
              aria-label={`${page.sets.length} of ${Math.max(page.targetSets, page.sets.length)} sets. ${setsOpen ? "Hide" : "Show"} sets`}
              onclick={toggleSets}
            >
              <span class="set-dots" aria-hidden="true">
                {#each dotIndices(
                  Math.max(page.targetSets, page.sets.length)
                ) as dot (dot)}
                  <i class:on={dot < page.sets.length}></i>
                {/each}
              </span>
              <span>
                {page.sets.length} of {Math.max(
                  page.targetSets,
                  page.sets.length
                )} sets
              </span>
              {#if done}
                <span class="done-pill">
                  <Check size={12} aria-hidden="true" />
                  Done
                </span>
              {/if}
              <ChevronRight
                size={15}
                class={`sets-chevron ${active && setsOpen ? "open" : ""}`}
                aria-hidden="true"
              />
            </button>

            {#if active && setsOpen}
              <div class="focus-set-panel" id="focus-sets-panel">
                {#if page.sets.length === 0}
                  <p class="focus-set-empty">No sets logged yet.</p>
                {:else}
                  {#each page.sets as set (set.id)}
                    {#if deleteTarget === set.id}
                      <div class="set-confirm">
                        <span>Delete set {set.setNumber}?</span>
                        <div class="set-confirm-actions">
                          <button
                            type="button"
                            class="btn btn-ghost btn-compact"
                            disabled={pending}
                            onclick={() => (deleteTarget = null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="btn btn-primary btn-compact"
                            disabled={pending}
                            onclick={() => void removeSet(set)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    {:else}
                      <div class="focus-set-row">
                        <span class="focus-set-number">Set {set.setNumber}</span>
                        <span class="focus-set-value">
                          {set.reps} × {formatWeight(set.weightKg)} kg
                        </span>
                        <button
                          type="button"
                          class="icon-btn danger"
                          aria-label={`Delete set ${set.setNumber} for ${page.name}`}
                          disabled={pending}
                          onclick={() => (deleteTarget = set.id)}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    {/if}
                  {/each}
                {/if}
                {#if deleteError}
                  <p class="error focus-set-error" role="alert">
                    {deleteError}
                  </p>
                {/if}
              </div>
            {/if}

            <div class="grow"></div>

            <div class="focus-actions">
              <button
                type="button"
                class="focus-primary"
                disabled={pending || !active}
                onclick={() => void logSet()}
              >
                {pending ? "Saving…" : "Log set"}
              </button>
              <div class="focus-foot">
                <div class="focus-foot-nav">
                  <button
                    type="button"
                    class="focus-back"
                    disabled={pageIndex === 0}
                    onclick={() => void goToPage(pageIndex - 1)}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    <span>
                      Back{pageIndex > 0
                        ? ` · ${pages[pageIndex - 1]?.name}`
                        : ""}
                    </span>
                  </button>
                  {#if pageIndex < pages.length - 1}
                    <button
                      type="button"
                      class="focus-next"
                      onclick={() => void goToPage(pageIndex + 1)}
                    >
                      <span>Next · {pages[pageIndex + 1]?.name}</span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  {:else}
                    <button
                      type="button"
                      class="focus-next"
                      disabled={finishing}
                      onclick={() => void finish()}
                    >
                      Finish workout
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </section>
        {/each}
      </div>
    </div>
  {/if}

  <SessionSheet
    open={showSwitcher}
    title="Exercises"
    onClose={() => (showSwitcher = false)}
  >
    <div class="switcher-list">
      {#each pages as page, pageIndex (page.exerciseId)}
        <button
          type="button"
          class="switcher-row"
          class:current={pageIndex === index}
          aria-current={pageIndex === index ? "true" : undefined}
          onclick={() => selectPage(pageIndex)}
        >
          <span class="switcher-index">{pageIndex + 1}</span>
          <span class="switcher-main">
            <span class="switcher-name">{page.name}</span>
            <span class="switcher-meta">
              {page.sets.length} / {page.targetSets} sets
            </span>
          </span>
          {#if isDone(page)}
            <Check class="switcher-check" size={16} aria-hidden="true" />
          {/if}
        </button>
      {/each}
    </div>

    {#if !plan}
      <div class="switcher-add">
        <label class="field grow">
          <span class="label">Add exercise</span>
          <select
            class="input"
            value={exerciseToAdd}
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
          class="btn btn-ghost btn-compact"
          disabled={!exerciseToAdd}
          onclick={() => void addExercise()}
        >
          Add
        </button>
      </div>
    {/if}

    {#if current?.exercise}
      <button
        type="button"
        class="switcher-action"
        onclick={openEditExercise}
      >
        Edit {current.name}
      </button>
    {/if}

    <button
      type="button"
      class="btn btn-primary switcher-finish"
      disabled={finishing}
      onclick={finishFromSwitcher}
    >
      {finishing ? "Finishing…" : "Finish workout"}
    </button>
  </SessionSheet>

  <SessionSheet
    open={showTimer}
    title="Rest timer"
    onClose={() => (showTimer = false)}
  >
    <div class="timer-presets">
      {#each REST_PRESETS as preset (preset)}
        <button
          type="button"
          class="btn btn-ghost timer-preset"
          aria-pressed={preset === timerPreset}
          onclick={() => selectPreset(preset)}
        >
          {formatRestTime(preset)}
        </button>
      {/each}
    </div>
    {#if timerRunning}
      <button
        type="button"
        class="btn btn-ghost timer-stop"
        onclick={() => {
          stopTimer();
          showTimer = false;
        }}
      >
        Stop timer
      </button>
    {/if}
    <p class="sheet-note">
      The timer starts automatically after each logged set. Notifications are in
      Settings.
    </p>
  </SessionSheet>

  <SessionSheet
    open={showEditExercise}
    title={current ? `Edit ${current.name}` : "Edit exercise"}
    onClose={() => (showEditExercise = false)}
  >
    {#if current?.exercise}
      <ExerciseForm
        exercise={current.exercise}
        onSubmit={saveExercise}
        onCancel={() => (showEditExercise = false)}
      />
    {:else}
      <p class="muted">This exercise is no longer in the register.</p>
    {/if}
  </SessionSheet>
</div>
