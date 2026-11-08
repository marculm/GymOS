<script lang="ts">
  import { onMount } from "svelte";
  import type {
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
    WorkoutSessionSummary,
  } from "@gymos/shared";
  import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";
  import { getSession, listSessions, updateSet } from "../../api/gym.mts";
  import { formatWeight } from "./format.mts";

  let { plans }: { plans: WorkoutPlan[] } = $props();

  const PAGE_SIZE = 10;

  let sessions = $state<WorkoutSessionSummary[]>([]);
  let totalElements = $state(0);
  let page = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let planId = $state("");
  let from = $state("");
  let to = $state("");
  let expandedId = $state<string | null>(null);
  let detail = $state<WorkoutSessionDetail | null>(null);
  let detailLoading = $state(false);
  let loadId = 0;
  let editingSetId = $state<string | null>(null);
  let editReps = $state<string | number | null>("");
  let editWeightKg = $state<string | number | null>("");
  let editPending = $state(false);
  let editError = $state<string | null>(null);

  function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : "Something went wrong";
  }

  function filters() {
    return {
      ...(planId ? { planId } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    };
  }

  async function loadPage(nextPage: number) {
    const requestId = ++loadId;
    loading = true;
    error = null;

    try {
      const result = await listSessions({
        page: nextPage,
        size: PAGE_SIZE,
        ...filters(),
      });
      if (requestId !== loadId) return;
      sessions =
        nextPage === 1 ? result.content : [...sessions, ...result.content];
      totalElements = result.page.totalElements;
      page = nextPage;
    } catch (loadError) {
      if (requestId === loadId) error = messageOf(loadError);
    } finally {
      if (requestId === loadId) loading = false;
    }
  }

  function applyFilters() {
    expandedId = null;
    detail = null;
    sessions = [];
    totalElements = 0;
    page = 0;
    void loadPage(1);
  }

  async function toggle(id: string) {
    if (expandedId === id) {
      expandedId = null;
      detail = null;
      detailLoading = false;
      return;
    }

    expandedId = id;
    detail = null;
    detailLoading = true;
    error = null;

    try {
      const loaded = await getSession(id);
      if (expandedId === id) detail = loaded;
    } catch (loadError) {
      if (expandedId === id) error = messageOf(loadError);
    } finally {
      if (expandedId === id) detailLoading = false;
    }
  }

  onMount(() => {
    void loadPage(1);
  });

  const detailPlan = $derived(
    plans.find((plan) => plan.id === detail?.planId) ?? null
  );

  function startEdit(set: LoggedSet) {
    editingSetId = set.id;
    editReps = set.reps;
    editWeightKg = set.weightKg;
    editError = null;
  }

  function cancelEdit() {
    editingSetId = null;
    editError = null;
  }

  async function saveEdit(set: LoggedSet, event: SubmitEvent) {
    event.preventDefault();
    if (!detail || editPending) return;
    if (editReps === "" || editWeightKg === "" || editReps == null || editWeightKg == null) {
      return;
    }

    editPending = true;
    editError = null;
    try {
      const updated = await updateSet(detail.id, set.id, {
        reps: Number(editReps),
        weightKg: Number(editWeightKg),
      });
      detail = {
        ...detail,
        sets: detail.sets.map((entry) =>
          entry.id === updated.id ? updated : entry
        ),
      };
      editingSetId = null;
    } catch (saveError) {
      editError =
        saveError instanceof Error
          ? saveError.message
          : "Could not update the set";
    } finally {
      editPending = false;
    }
  }

  function firstSetTime(group: { sets: LoggedSet[] }): number {
    return group.sets[0] ? Date.parse(group.sets[0].createdAt) : 0;
  }

  const groups = $derived.by(() => {
    if (!detail) return [];
    const map = new Map<string, { name: string; sets: LoggedSet[] }>();

    for (const set of detail.sets) {
      const group = map.get(set.exerciseId) ?? {
        name: set.exerciseName,
        sets: [],
      };
      group.sets.push(set);
      map.set(set.exerciseId, group);
    }

    for (const group of map.values()) {
      group.sets.sort((a, b) => a.setNumber - b.setNumber);
    }

    const planPositions = new Map(
      (detailPlan?.exercises ?? []).map((entry, index) => [
        entry.exercise.id,
        index,
      ])
    );

    return [...map.entries()]
      .map(([exerciseId, group]) => ({ exerciseId, ...group }))
      .sort((a, b) => {
        const aPosition = planPositions.get(a.exerciseId);
        const bPosition = planPositions.get(b.exerciseId);
        if (aPosition !== undefined || bPosition !== undefined) {
          return (
            (aPosition ?? Number.MAX_SAFE_INTEGER) -
            (bPosition ?? Number.MAX_SAFE_INTEGER)
          );
        }
        return firstSetTime(a) - firstSetTime(b);
      });
  });

  const hasFilters = $derived(Boolean(planId || from || to));

  function durationMinutes(
    startedAt: string,
    completedAt: string | null
  ): number | null {
    if (!completedAt) return null;
    return Math.max(
      0,
      Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
          60_000
      )
    );
  }
</script>

<div class="stack">
  <div class="row">
    <label class="field grow">
      <span class="label">Plan</span>
      <select
        class="input"
        value={planId}
        onchange={(event) => {
          planId = event.currentTarget.value;
          applyFilters();
        }}
      >
        <option value="">All plans</option>
        {#each plans as plan (plan.id)}
          <option value={plan.id}>{plan.name}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span class="label">From</span>
      <input
        class="input"
        type="date"
        value={from}
        onchange={(event) => {
          from = event.currentTarget.value;
          applyFilters();
        }}
      />
    </label>
    <label class="field">
      <span class="label">To</span>
      <input
        class="input"
        type="date"
        value={to}
        onchange={(event) => {
          to = event.currentTarget.value;
          applyFilters();
        }}
      />
    </label>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
    {#if sessions.length === 0}
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => void loadPage(1)}
      >
        Retry
      </button>
    {/if}
  {/if}

  {#if loading && sessions.length === 0}
    <p class="muted">Loading history…</p>
  {:else if sessions.length === 0 && !error}
    <p class="empty">
      {hasFilters ? "No workouts match these filters" : "No completed workouts yet"}
    </p>
  {/if}

  {#each sessions as session (session.id)}
    {@const expanded = expandedId === session.id}
    {@const duration = durationMinutes(
      session.startedAt,
      session.completedAt
    )}
    <article class="card stack">
      <div class="row">
        <div class="grow">
          <p class="muted">
            {new Date(session.startedAt).toLocaleDateString()}
            {#if duration !== null}
              · {duration} min
            {/if}
            · {session.totalSets}
            {session.totalSets === 1 ? "set" : "sets"}
          </p>
          <h3 class="card-title">{session.title}</h3>
        </div>
        <button
          type="button"
          class="btn btn-ghost"
          aria-expanded={expanded}
          aria-controls={`history-${session.id}`}
          aria-label={expanded
            ? `Hide ${session.title}`
            : `View ${session.title}`}
          onclick={() => void toggle(session.id)}
        >
          {expanded ? "Hide" : "View"}
        </button>
      </div>

      <div class="stack" id={`history-${session.id}`} hidden={!expanded}>
        {#if expanded}
          {#if detailLoading}
            <p class="muted">Loading workout…</p>
          {:else if detail}
            {@const detailDuration = durationMinutes(
              detail.startedAt,
              detail.completedAt
            )}
            <p class="muted">
              {new Date(detail.startedAt).toLocaleString()} – {detail.completedAt
                ? new Date(detail.completedAt).toLocaleString()
                : "in progress"}
              {#if detailDuration !== null}
                · {detailDuration} min
              {/if}
            </p>

            {#if groups.length === 0}
              <p class="muted">No sets logged</p>
            {:else}
              {#each groups as group (group.exerciseId)}
                <div class="stack">
                  <h4 class="card-title">{group.name}</h4>
                  {#each group.sets as set (set.id)}
                    {#if editingSetId === set.id}
                      <form
                        class="stack"
                        aria-label={`Edit set ${set.setNumber} for ${group.name}`}
                        onsubmit={(event) => void saveEdit(set, event)}
                      >
                        <div class="row set-fields">
                          <label class="field set-field">
                            <span class="label">Reps</span>
                            <input
                              class="input"
                              type="number"
                              min={1}
                              max={MAX_SET_REPS}
                              required
                              aria-label={`Reps for set ${set.setNumber} of ${group.name}`}
                              bind:value={editReps}
                            />
                          </label>
                          <label class="field set-field">
                            <span class="label">Weight (kg)</span>
                            <input
                              class="input"
                              type="number"
                              min={0}
                              max={MAX_SET_WEIGHT_KG}
                              step={0.01}
                              required
                              aria-label={`Weight for set ${set.setNumber} of ${group.name}`}
                              bind:value={editWeightKg}
                            />
                          </label>
                        </div>
                        {#if editError}
                          <p class="error" role="alert">{editError}</p>
                        {/if}
                        <div class="row">
                          <button
                            type="submit"
                            class="btn btn-primary"
                            disabled={editPending}
                            aria-label={`Save set ${set.setNumber} for ${group.name}`}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost"
                            disabled={editPending}
                            aria-label={`Cancel editing set ${set.setNumber} for ${group.name}`}
                            onclick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    {:else}
                      <p class="set-row">
                        <span class="badge">Set {set.setNumber}</span>
                        <span class="grow">
                          {set.reps} × {formatWeight(set.weightKg)} kg
                        </span>
                        <button
                          type="button"
                          class="btn btn-ghost"
                          aria-label={`Edit set ${set.setNumber} for ${group.name}`}
                          onclick={() => startEdit(set)}
                        >
                          Edit
                        </button>
                      </p>
                    {/if}
                  {/each}
                </div>
              {/each}
            {/if}
          {/if}
        {/if}
      </div>
    </article>
  {/each}

  {#if sessions.length < totalElements}
    <button
      type="button"
      class="btn btn-ghost"
      disabled={loading}
      onclick={() => void loadPage(page + 1)}
    >
      Load more
    </button>
  {/if}
</div>
