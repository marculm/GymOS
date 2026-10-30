<script lang="ts">
  import { onMount } from "svelte";
  import type {
    CreateExerciseInput,
    CreateWorkoutPlanInput,
    CreateWorkoutSetInput,
    Exercise,
    WorkoutPlan,
    WorkoutRotation,
    WorkoutSessionDetail,
    WorkoutSessionSummary,
  } from "@gymos/shared";
  import { ApiError } from "../../api/client.mts";
  import {
    addSet,
    completeSession,
    createExercise,
    createPlan,
    deleteExercise,
    deletePlan,
    getActiveSession,
    getRotation,
    listAllExercises,
    listAllPlans,
    listSessions,
    setRotation,
    startSession,
    updateExercise,
    updatePlan,
  } from "../../api/gym.mts";
  import ExerciseRegister from "./ExerciseRegister.svelte";
  import PlanForm from "./PlanForm.svelte";
  import SessionView from "./SessionView.svelte";

  let exercises = $state<Exercise[]>([]);
  let plans = $state<WorkoutPlan[]>([]);
  let rotation = $state<WorkoutRotation>({ plans: [], nextPlanId: null });
  let activeSession = $state<WorkoutSessionDetail | null>(null);
  let history = $state<WorkoutSessionSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showPlanForm = $state(false);
  let editingPlan = $state<WorkoutPlan | null>(null);
  let pending = $state(false);
  let rotationPending = $state(false);
  let planToAdd = $state("");

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  async function load() {
    loading = true;
    error = null;

    try {
      const [exerciseList, planList, rotationState, active, sessionPage] =
        await Promise.all([
          listAllExercises(),
          listAllPlans(),
          getRotation(),
          getActiveSession(),
          listSessions({ size: 10 }),
        ]);
      exercises = exerciseList;
      plans = planList;
      rotation = rotationState;
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

  async function handleUpdatePlan(input: CreateWorkoutPlanInput) {
    if (!editingPlan) return;
    const updated = await updatePlan(editingPlan.id, input);
    plans = plans.map((plan) => (plan.id === updated.id ? updated : plan));
    rotation = {
      ...rotation,
      plans: rotation.plans.map((entry) =>
        entry.id === updated.id ? updated : entry
      ),
    };
    editingPlan = null;
  }

  async function handleDeletePlan(plan: WorkoutPlan) {
    if (!confirm(`Delete ${plan.name}? Past workouts keep their records.`)) {
      return;
    }

    error = null;
    try {
      await deletePlan(plan.id);
      plans = plans.filter((entry) => entry.id !== plan.id);
      if (editingPlan?.id === plan.id) editingPlan = null;
    } catch (deleteError) {
      error = messageOf(deleteError);
      return;
    }

    try {
      rotation = await getRotation();
    } catch {
      // The plan is deleted; the rotation refreshes on the next load.
    }
  }

  async function saveRotation(planIds: string[]) {
    rotationPending = true;
    error = null;
    try {
      rotation = await setRotation({ planIds });
      planToAdd = "";
    } catch (rotationError) {
      error = messageOf(rotationError);
    } finally {
      rotationPending = false;
    }
  }

  function moveRotationPlan(index: number, offset: number) {
    const planIds = rotation.plans.map((plan) => plan.id);
    const target = index + offset;
    const current = planIds[index];
    const other = planIds[target];
    if (current === undefined || other === undefined) return;

    planIds[index] = other;
    planIds[target] = current;
    void saveRotation(planIds);
  }

  function removeRotationPlan(planId: string) {
    void saveRotation(
      rotation.plans.filter((plan) => plan.id !== planId).map((plan) => plan.id)
    );
  }

  function addRotationPlan() {
    if (!planToAdd) return;
    void saveRotation([...rotation.plans.map((plan) => plan.id), planToAdd]);
  }

  async function handleCreateExercise(input: CreateExerciseInput) {
    const created = await createExercise(input);
    exercises = [...exercises, created].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async function handleUpdateExercise(id: string, input: CreateExerciseInput) {
    const updated = await updateExercise(id, input);
    exercises = exercises
      .map((exercise) => (exercise.id === id ? updated : exercise))
      .sort((a, b) => a.name.localeCompare(b.name));
    plans = plans.map((plan) => ({
      ...plan,
      exercises: plan.exercises.map((entry) =>
        entry.exercise.id === id ? { ...entry, exercise: updated } : entry
      ),
    }));
  }

  async function handleDeleteExercise(id: string) {
    await deleteExercise(id);
    exercises = exercises.filter((exercise) => exercise.id !== id);
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
      const [sessionPage, rotationState] = await Promise.all([
        listSessions({ size: 10 }),
        getRotation(),
      ]);
      history = sessionPage.content;
      rotation = rotationState;
    } catch {
      // The workout is complete; the rest refreshes on the next load.
    }
  }

  const nextPlan = $derived(
    rotation.plans.find((plan) => plan.id === rotation.nextPlanId) ?? null
  );

  const availableRotationPlans = $derived(
    plans.filter(
      (plan) => !rotation.plans.some((entry) => entry.id === plan.id)
    )
  );

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

    <section class="card stack">
      <h2 class="card-title">Training rotation</h2>

      {#if nextPlan}
        <div>
          <p class="muted">Next up</p>
          <h3 class="card-title">{nextPlan.name}</h3>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          disabled={pending || rotationPending}
          onclick={() => void start({ planId: nextPlan.id })}
        >
          Start next plan
        </button>
      {:else}
        <p class="empty">Add plans to set up a rotation</p>
      {/if}

      {#each rotation.plans as plan, index (plan.id)}
        <div class="row">
          <span class="badge">{index + 1}</span>
          <span class="grow">{plan.name}</span>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={rotationPending || index === 0}
            aria-label={`Move ${plan.name} up`}
            onclick={() => moveRotationPlan(index, -1)}
          >
            Up
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={rotationPending || index === rotation.plans.length - 1}
            aria-label={`Move ${plan.name} down`}
            onclick={() => moveRotationPlan(index, 1)}
          >
            Down
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={rotationPending}
            aria-label={`Remove ${plan.name} from rotation`}
            onclick={() => removeRotationPlan(plan.id)}
          >
            Remove
          </button>
        </div>
      {/each}

      {#if availableRotationPlans.length > 0}
        <div class="row">
          <label class="field grow">
            <span class="label">Add plan to rotation</span>
            <select
              class="input"
              value={planToAdd}
              onchange={(event) => (planToAdd = event.currentTarget.value)}
            >
              <option value="">Choose a plan</option>
              {#each availableRotationPlans as plan (plan.id)}
                <option value={plan.id}>{plan.name}</option>
              {/each}
            </select>
          </label>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={rotationPending ||
              !availableRotationPlans.some((plan) => plan.id === planToAdd)}
            onclick={addRotationPlan}
          >
            Add
          </button>
        </div>
      {/if}
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
            <div class="row">
              <button
                type="button"
                class="btn btn-ghost"
                aria-label={`Edit ${plan.name}`}
                onclick={() => {
                  showPlanForm = false;
                  editingPlan = plan;
                }}
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                aria-label={`Delete ${plan.name}`}
                onclick={() => void handleDeletePlan(plan)}
              >
                Delete
              </button>
            </div>
          </article>
        {/each}
      {/if}

      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => {
          if (editingPlan) {
            editingPlan = null;
            return;
          }
          showPlanForm = !showPlanForm;
        }}
      >
        {showPlanForm || editingPlan ? "Cancel" : "Create plan"}
      </button>

      {#if showPlanForm}
        <PlanForm exercises={exercises} onSubmit={handleCreatePlan} />
      {:else if editingPlan}
        {#key editingPlan?.id}
          <PlanForm
            exercises={exercises}
            plan={editingPlan}
            onSubmit={handleUpdatePlan}
          />
        {/key}
      {/if}
    </section>

    <section class="stack">
      <h2 class="card-title">Exercise register</h2>
      <ExerciseRegister
        exercises={exercises}
        onCreate={handleCreateExercise}
        onUpdate={handleUpdateExercise}
        onDelete={handleDeleteExercise}
      />
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
