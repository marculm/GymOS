<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    ChevronDown,
    ChevronUp,
    Pencil,
    Plus,
    Trash2,
    X,
  } from "lucide-svelte";
  import type {
    CreateExerciseInput,
    CreateWorkoutPlanInput,
    Exercise,
    WorkoutPlan,
  } from "@gymos/shared";
  import ExerciseRegister from "./ExerciseRegister.svelte";
  import { gymData } from "./gym-data.svelte.ts";
  import PlanForm from "./PlanForm.svelte";

  let { view }: { view: "plans" | "exercises" } = $props();

  let error = $state<string | null>(null);
  let rotationPending = $state(false);
  let planToAdd = $state("");
  let showPlanForm = $state(false);
  let editingPlan = $state<WorkoutPlan | null>(null);

  const availableRotationPlans = $derived(
    gymData.plans.filter(
      (plan) => !gymData.rotation.plans.some((entry) => entry.id === plan.id)
    )
  );

  onMount(() => {
    void gymData.load();
  });

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  async function handleCreatePlan(input: CreateWorkoutPlanInput) {
    error = null;
    const created = await gymData.createPlan(input);
    showPlanForm = false;
    await tick();
    document.getElementById(`edit-plan-${created.id}`)?.focus();
  }

  async function handleUpdatePlan(input: CreateWorkoutPlanInput) {
    if (!editingPlan) return;
    const planId = editingPlan.id;
    error = null;
    await gymData.updatePlan(planId, input);
    editingPlan = null;
    await tick();
    document.getElementById(`edit-plan-${planId}`)?.focus();
  }

  async function closePlanForm() {
    const planId = editingPlan?.id;
    editingPlan = null;
    showPlanForm = false;
    await tick();
    document
      .getElementById(planId ? `edit-plan-${planId}` : "new-plan-button")
      ?.focus();
  }

  async function handleDeletePlan(plan: WorkoutPlan) {
    if (!confirm(`Delete ${plan.name}? Past workouts keep their records.`)) {
      return;
    }
    error = null;
    try {
      await gymData.deletePlan(plan.id);
    } catch (deleteError) {
      error = messageOf(deleteError);
    }
  }

  async function saveRotation(planIds: string[]) {
    rotationPending = true;
    error = null;
    try {
      await gymData.saveRotation(planIds);
      planToAdd = "";
    } catch (rotationError) {
      error = messageOf(rotationError);
    } finally {
      rotationPending = false;
    }
  }

  function moveRotationPlan(index: number, offset: number) {
    rotationPending = true;
    error = null;
    void gymData
      .moveRotation(index, offset)
      .catch((rotationError) => (error = messageOf(rotationError)))
      .finally(() => (rotationPending = false));
  }

  function removeRotationPlan(planId: string) {
    rotationPending = true;
    error = null;
    void gymData
      .removeRotation(planId)
      .catch((rotationError) => (error = messageOf(rotationError)))
      .finally(() => (rotationPending = false));
  }

  function addRotationPlan() {
    if (!planToAdd) return;
    void saveRotation([
      ...gymData.rotation.plans.map((plan) => plan.id),
      planToAdd,
    ]);
  }

  async function handleCreateExercise(
    input: CreateExerciseInput
  ): Promise<Exercise> {
    return gymData.createExercise(input);
  }

  async function handleUpdateExercise(
    exerciseId: string,
    input: CreateExerciseInput
  ): Promise<void> {
    await gymData.updateExercise(exerciseId, input);
  }

  async function handleDeleteExercise(exerciseId: string): Promise<void> {
    await gymData.deleteExercise(exerciseId);
  }
</script>

{#if gymData.loading && gymData.plans.length === 0 && gymData.exercises.length === 0}
  <p class="muted settings-loading">Loading…</p>
{:else if gymData.error}
  <div class="stack">
    <p class="error" role="alert">{gymData.error}</p>
    <button type="button" class="btn btn-ghost" onclick={() => void gymData.load(true)}>
      Retry
    </button>
  </div>
{:else if view === "exercises"}
  <ExerciseRegister
    exercises={gymData.exercises}
    onCreate={handleCreateExercise}
    onUpdate={handleUpdateExercise}
    onDelete={handleDeleteExercise}
  />
{:else}
  <div class="stack panel">
    <section class="section" aria-labelledby="rotation-heading">
      <h3 class="section-title" id="rotation-heading">Training rotation</h3>
      <div class="group">
        {#each gymData.rotation.plans as plan, index (plan.id)}
          <div class="list-row rotation-row">
            <span class="index-badge">{index + 1}</span>
            <span class="list-main">
              <span class="list-title">{plan.name}</span>
            </span>
            <div class="list-actions">
              <button
                type="button"
                class="icon-btn muted"
                disabled={rotationPending || index === 0}
                aria-label={`Move ${plan.name} up`}
                onclick={() => moveRotationPlan(index, -1)}
              >
                <ChevronUp size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="icon-btn muted"
                disabled={rotationPending || index === gymData.rotation.plans.length - 1}
                aria-label={`Move ${plan.name} down`}
                onclick={() => moveRotationPlan(index, 1)}
              >
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="icon-btn danger"
                disabled={rotationPending}
                aria-label={`Remove ${plan.name} from rotation`}
                onclick={() => removeRotationPlan(plan.id)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        {:else}
          <p class="group-empty">Add plans to set up a rotation</p>
        {/each}

        {#if availableRotationPlans.length > 0}
          <div class="list-row">
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
              class="btn btn-primary btn-compact"
              disabled={rotationPending ||
                !availableRotationPlans.some((plan) => plan.id === planToAdd)}
              onclick={addRotationPlan}
            >
              Add
            </button>
          </div>
        {/if}
      </div>
    </section>

    <section class="section" aria-labelledby="plans-heading">
      <h3 class="section-title" id="plans-heading">Training plans</h3>
      <div class="group plans-group">
        {#if showPlanForm}
          <div class="group-form">
            <PlanForm
              exercises={gymData.exercises}
              onSubmit={handleCreatePlan}
              onCancel={closePlanForm}
            />
          </div>
        {/if}

        {#if gymData.plans.length === 0 && !showPlanForm}
          <p class="group-empty">No plans yet</p>
        {:else}
          {#each gymData.plans as plan (plan.id)}
            {#if editingPlan?.id === plan.id}
              <div class="group-form">
                <PlanForm
                  exercises={gymData.exercises}
                  plan={editingPlan}
                  onSubmit={handleUpdatePlan}
                  onCancel={closePlanForm}
                />
              </div>
            {:else}
              <div class="list-row plan-row">
                <div class="list-main">
                  <h4 class="list-title">{plan.name}</h4>
                  <span class="list-subtitle">
                    {plan.exercises.length}
                    {plan.exercises.length === 1 ? "exercise" : "exercises"}
                  </span>
                </div>
                <div class="list-actions">
                  <button
                    type="button"
                    class="icon-btn muted"
                    id={`edit-plan-${plan.id}`}
                    aria-label={`Edit ${plan.name}`}
                    onclick={() => {
                      showPlanForm = false;
                      editingPlan = plan;
                    }}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn muted"
                    aria-label={`Delete ${plan.name}`}
                    onclick={() => void handleDeletePlan(plan)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        {/if}

        {#if !showPlanForm && !editingPlan}
          <button
            type="button"
            class="list-row add-row"
            id="new-plan-button"
            onclick={() => {
              editingPlan = null;
              showPlanForm = true;
            }}
          >
            <Plus size={18} aria-hidden="true" />
            New plan
          </button>
        {/if}
      </div>
    </section>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
  </div>
{/if}
