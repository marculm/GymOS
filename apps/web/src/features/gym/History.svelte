<script lang="ts">
  import { onMount } from "svelte";
  import type {
    LoggedSet,
    WorkoutPlan,
    WorkoutSessionDetail,
    WorkoutSessionSummary,
  } from "@gymos/shared";
  import { getSession, listSessions } from "../../api/gym.mts";
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

  function targetFor(exerciseId: string): string | null {
    const entry = detailPlan?.exercises.find(
      (item) => item.exercise.id === exerciseId
    );
    if (!entry) return null;
    return `${entry.targetSets} × ${entry.targetReps}${
      entry.targetWeightKg != null
        ? ` @ ${formatWeight(entry.targetWeightKg)} kg`
        : ""
    }`;
  }

  function durationMinutes(session: WorkoutSessionDetail): number | null {
    if (!session.completedAt) return null;
    return Math.max(
      0,
      Math.round(
        (new Date(session.completedAt).getTime() -
          new Date(session.startedAt).getTime()) /
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
    <article class="card stack">
      <div class="row">
        <div class="grow">
          <p class="muted">
            {new Date(session.startedAt).toLocaleDateString()} ·
            {session.totalSets}
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
            <p class="muted">
              {new Date(detail.startedAt).toLocaleString()} – {detail.completedAt
                ? new Date(detail.completedAt).toLocaleString()
                : "in progress"}
              {#if durationMinutes(detail) !== null}
                · {durationMinutes(detail)} min
              {/if}
            </p>

            {#if groups.length === 0}
              <p class="muted">No sets logged</p>
            {:else}
              {#each groups as group (group.exerciseId)}
                {@const target = targetFor(group.exerciseId)}
                <div class="stack">
                  <div>
                    <h4 class="card-title">{group.name}</h4>
                    {#if target}
                      <p class="muted">{target}</p>
                    {/if}
                  </div>
                  {#each group.sets as set (set.id)}
                    <p class="set-row">
                      <span class="badge">Set {set.setNumber}</span>
                      <span>{set.reps} × {formatWeight(set.weightKg)} kg</span>
                    </p>
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
