<script lang="ts">
  import { onMount, tick } from "svelte";
  import { ChevronRight } from "lucide-svelte";
  import type {
    CreateExerciseInput,
    CreateWorkoutSetInput,
    WorkoutSessionDetail,
  } from "@gymos/shared";
  import {
    addSet,
    completeSession,
    deleteSet,
    getActiveSession,
    startSession,
  } from "../../api/gym.mts";
  import { ApiError } from "../../api/client.mts";
  import { gymData } from "./gym-data.svelte.ts";
  import SessionView from "./SessionView.svelte";
  import WorkoutPicker from "./WorkoutPicker.svelte";
  import SettingsButton from "$lib/SettingsButton.svelte";
  import { settings } from "$lib/settings.svelte.ts";
  import { goToSpace, spaceSwipe } from "$lib/space.ts";

  let activeSession = $state<WorkoutSessionDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pending = $state(false);
  let showPicker = $state(false);

  const nextPlan = $derived(gymData.nextPlan);
  const matchingPlan = $derived(
    activeSession === null
      ? null
      : gymData.plans.find((plan) => plan.id === activeSession?.planId) ?? null
  );

  onMount(() => {
    void loadStart();
  });

  async function loadStart() {
    loading = true;
    error = null;
    try {
      const [, active] = await Promise.all([
        gymData.load(),
        getActiveSession(),
      ]);
      activeSession = active;
    } catch (loadError) {
      error = messageOf(loadError);
    } finally {
      loading = false;
    }
  }

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  async function start(input: { planId?: string }) {
    const trigger = document.activeElement;
    pending = true;
    error = null;

    try {
      activeSession = await startSession(input);
    } catch (startError) {
      if (startError instanceof ApiError && startError.status === 409) {
        try {
          const active = await getActiveSession();
          activeSession = active ?? (await startSession(input));
        } catch (retryError) {
          error = messageOf(retryError);
        }
      } else {
        error = messageOf(startError);
      }
    } finally {
      pending = false;
      if (activeSession) {
        showPicker = false;
        await tick();
        document.getElementById("session-focus")?.focus();
      } else {
        await tick();
        if (trigger instanceof HTMLElement && trigger.isConnected) {
          trigger.focus();
        }
      }
    }
  }

  async function refreshAfterFinish() {
    activeSession = null;
    await gymData.reload();
    await tick();
    document.getElementById("next-workout-heading")?.focus();
  }

  async function recoverCompletedSession(
    operationError: unknown
  ): Promise<boolean> {
    if (!(operationError instanceof ApiError) || operationError.status !== 409) {
      return false;
    }
    if (await getActiveSession()) return false;
    await refreshAfterFinish();
    return true;
  }

  async function handleLogSet(input: CreateWorkoutSetInput) {
    if (!activeSession) return;
    try {
      const set = await addSet(activeSession.id, input);
      activeSession = {
        ...activeSession,
        sets: [...activeSession.sets, set],
      };
    } catch (logError) {
      await recoverCompletedSession(logError);
      throw logError;
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!activeSession) return;
    const deleted = activeSession.sets.find((set) => set.id === setId);
    if (!deleted) return;

    try {
      await deleteSet(activeSession.id, setId);
    } catch (deleteError) {
      if (await recoverCompletedSession(deleteError)) return;
      throw deleteError;
    }

    const counters = new Map<string, number>();
    const sets = activeSession.sets
      .filter((set) => set.id !== setId)
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((set) => {
        if (set.exerciseId !== deleted.exerciseId) return set;
        const setNumber = (counters.get(set.exerciseId) ?? 0) + 1;
        counters.set(set.exerciseId, setNumber);
        return { ...set, setNumber };
      });

    activeSession = { ...activeSession, sets };
  }

  async function handleUpdateExercise(
    exerciseId: string,
    input: CreateExerciseInput
  ) {
    await gymData.updateExercise(exerciseId, input);
  }

  async function handleComplete() {
    if (!activeSession) return;
    try {
      await completeSession(activeSession.id);
    } catch (completeError) {
      if (await recoverCompletedSession(completeError)) return;
      throw completeError;
    }
    await refreshAfterFinish();
  }
</script>

{#if loading}
  <div class="space-screen training-space">
    <SettingsButton />
    <div class="space-column start-loading">
      <p class="start-eyebrow">Today</p>
      <p class="muted">Loading…</p>
    </div>
  </div>
{:else if activeSession}
  <SessionView
    session={activeSession}
    plan={matchingPlan}
    exercises={gymData.exercises}
    onLogSet={handleLogSet}
    onDeleteSet={handleDeleteSet}
    onUpdateExercise={handleUpdateExercise}
    onComplete={handleComplete}
  />
{:else}
  <div
    class="space-screen training-space"
    use:spaceSwipe={{
      onSwipeLeft: () => {
        if (!pending) goToSpace("nutrition");
      },
    }}
  >
    <SettingsButton />

    <div class="space-column start-screen">
      <div class="start-top">
        <span class="start-eyebrow">Today</span>
      </div>

      {#if (error || gymData.error) && gymData.plans.length === 0}
        <div class="start-error">
          <p class="error" role="alert">{error ?? gymData.error}</p>
          <button type="button" class="btn btn-ghost" onclick={() => void loadStart()}>
            Retry
          </button>
        </div>
      {:else if nextPlan}
        <div class="start-hero">
          <p class="start-eyebrow">Next workout</p>
          <h1 class="start-title" id="next-workout-heading" tabindex="-1">
            {nextPlan.name}
          </h1>
          {#if nextPlan.description}
            <p class="start-description">{nextPlan.description}</p>
          {/if}
          <p class="start-meta">
            {nextPlan.exercises.length}
            {nextPlan.exercises.length === 1 ? "exercise" : "exercises"}
          </p>
        </div>

        <div class="start-actions">
          <button
            type="button"
            class="start-primary"
            disabled={pending}
            onclick={() => void start({ planId: nextPlan.id })}
          >
            Start workout
          </button>
          <button
            type="button"
            class="start-secondary"
            disabled={pending}
            onclick={() => {
              error = null;
              showPicker = true;
            }}
          >
            Other workout
          </button>
        </div>
      {:else}
        <div class="start-hero">
          <p class="start-eyebrow">Today</p>
          <h1 class="start-title" id="next-workout-heading" tabindex="-1">
            No workout scheduled
          </h1>
          <p class="start-description">
            Add plans to your rotation and the next workout shows up here.
          </p>
        </div>

        <div class="start-actions">
          <button
            type="button"
            class="start-primary"
            onclick={() => settings.show("plans")}
          >
            Set up training plan
          </button>
          <button
            type="button"
            class="start-secondary"
            disabled={pending}
            onclick={() => {
              error = null;
              showPicker = true;
            }}
          >
            Other workout
          </button>
        </div>
      {/if}

      {#if error && gymData.plans.length > 0}
        <div class="start-error">
          <p class="error" role="alert">{error}</p>
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => void loadStart()}
          >
            Retry
          </button>
        </div>
      {/if}

      <button
        type="button"
        class="space-hint"
        aria-label="Go to Nutrition"
        onclick={() => goToSpace("nutrition")}
      >
        <span class="dots" aria-hidden="true"><i class="on"></i><i></i></span>
        <span>Nutrition</span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>

    {#if showPicker}
      <WorkoutPicker
        plans={gymData.plans}
        pending={pending}
        error={error}
        onStart={start}
        onClose={() => (showPicker = false)}
      />
    {/if}
  </div>
{/if}
