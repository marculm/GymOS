<script lang="ts">
  import { onMount } from "svelte";
  import type {
    CreateWorkoutPlanInput,
    CreateWorkoutSetInput,
    Exercise,
    WorkoutPlan,
    WorkoutSessionDetail,
    WorkoutSessionSummary,
  } from "@gymos/shared";
  import { ApiError } from "../../api/client.mts";
  import {
    addSet,
    completeSession,
    createPlan,
    getActiveSession,
    listAllExercises,
    listAllPlans,
    listSessions,
    startSession,
  } from "../../api/gym.mts";
  import PlanForm from "./PlanForm.svelte";
  import SessionView from "./SessionView.svelte";

  let exercises = $state<Exercise[]>([]);
  let plans = $state<WorkoutPlan[]>([]);
  let activeSession = $state<WorkoutSessionDetail | null>(null);
  let history = $state<WorkoutSessionSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showPlanForm = $state(false);
  let pending = $state(false);

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  async function load() {
    loading = true;
    error = null;

    try {
      const [exerciseList, planList, active, sessionPage] = await Promise.all([
        listAllExercises(),
        listAllPlans(),
        getActiveSession(),
        listSessions({ size: 10 }),
      ]);
      exercises = exerciseList;
      plans = planList;
      activeSession = active;
      history = sessionPage.content;
    } catch (loadError) {
      error = messageOf(loadError);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  async function start(input: { planId?: string }) {
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
    }
  }

  async function handleCreatePlan(input: CreateWorkoutPlanInput) {
    const created = await createPlan(input);
    plans = [created, ...plans];
    showPlanForm = false;
  }

  async function handleLogSet(input: CreateWorkoutSetInput) {
    if (!activeSession) return;
    const set = await addSet(activeSession.id, input);
    activeSession = { ...activeSession, sets: [...activeSession.sets, set] };
  }

  async function handleComplete() {
    if (!activeSession) return;
    await completeSession(activeSession.id);
    activeSession = null;
    try {
      history = (await listSessions({ size: 10 })).content;
    } catch {
      // The workout is complete; history refreshes on the next load.
    }
  }

  const matchingPlan = $derived(
    activeSession === null
      ? null
      : plans.find((plan) => plan.id === activeSession?.planId) ?? null
  );
</script>

{#if loading}
  <p class="muted">Loading gym data…</p>
{:else if error && plans.length === 0 && exercises.length === 0}
  <div class="card stack">
    <p class="error">{error}</p>
    <button type="button" class="btn btn-ghost" onclick={() => void load()}>
      Retry
    </button>
  </div>
{:else if activeSession}
  <SessionView
    session={activeSession}
    plan={matchingPlan}
    exercises={exercises}
    onLogSet={handleLogSet}
    onComplete={handleComplete}
  />
{:else}
  <div class="stack">
    {#if error}
      <p class="error">{error}</p>
    {/if}

    <section class="card stack">
      <h2 class="card-title">Today&apos;s workout</h2>
      <p class="muted">Start a session and log sets as you go.</p>
      <button
        type="button"
        class="btn btn-primary"
        disabled={pending}
        onclick={() => void start({})}
      >
        Start free workout
      </button>
    </section>

    <section class="stack">
      <h2 class="card-title">Training plans</h2>
      {#if plans.length === 0}
        <p class="empty">No plans yet</p>
      {:else}
        {#each plans as plan (plan.id)}
          <article class="card plan-card stack">
            <div>
              <h3 class="card-title">{plan.name}</h3>
              {#if plan.description}
                <p class="muted">{plan.description}</p>
              {/if}
            </div>
            <div class="row">
              <span class="badge">
                {plan.exercises.length}
                {plan.exercises.length === 1 ? "exercise" : "exercises"}
              </span>
              <button
                type="button"
                class="btn btn-primary"
                disabled={pending}
                onclick={() => void start({ planId: plan.id })}
              >
                Start plan
              </button>
            </div>
          </article>
        {/each}
      {/if}

      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => (showPlanForm = !showPlanForm)}
      >
        {showPlanForm ? "Cancel" : "Create plan"}
      </button>

      {#if showPlanForm}
        <PlanForm exercises={exercises} onSubmit={handleCreatePlan} />
      {/if}
    </section>

    <section class="stack">
      <h2 class="card-title">Recent workouts</h2>
      {#if history.length === 0}
        <p class="empty">No completed workouts yet</p>
      {:else}
        {#each history as session (session.id)}
          <article class="card">
            <h3 class="card-title">{session.title}</h3>
            <div class="row">
              <span class="muted">
                {new Date(session.startedAt).toLocaleDateString()}
              </span>
              <span class="badge">
                {session.totalSets}
                {session.totalSets === 1 ? "set" : "sets"}
              </span>
            </div>
          </article>
        {/each}
      {/if}
    </section>
  </div>
{/if}
