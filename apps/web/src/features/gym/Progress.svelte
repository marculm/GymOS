<script lang="ts">
  import { onMount } from "svelte";
  import type { WorkoutProgress } from "@gymos/shared";
  import { getProgress } from "../../api/gym.mts";

  let progress = $state<WorkoutProgress | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;

    try {
      progress = await getProgress();
    } catch (loadError) {
      error =
        loadError instanceof Error ? loadError.message : "Something went wrong";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  const recentVolume = $derived.by(() => {
    const points = progress?.volume.slice(0, 10) ?? [];
    const max = Math.max(0, ...points.map((point) => point.totalVolumeKg));
    return points.map((point) => ({
      ...point,
      percent:
        max > 0 ? Math.round((point.totalVolumeKg / max) * 100) : 0,
    }));
  });
</script>

<section class="stack" aria-labelledby="progress-heading">
  <h2 class="card-title" id="progress-heading">Progress</h2>

  {#if loading}
    <p class="muted">Loading progress…</p>
  {:else if error}
    <p class="error" role="alert">{error}</p>
  {:else if progress}
    <div class="card stack">
      <h3 class="card-title">Personal records</h3>
      {#if progress.personalRecords.length === 0}
        <p class="empty">No records yet</p>
      {:else}
        {#each progress.personalRecords as record (record.exerciseId)}
          <div class="row">
            <span class="grow">{record.exerciseName}</span>
            <span>{record.weightKg} kg × {record.reps}</span>
          </div>
        {/each}
      {/if}
    </div>

    <div class="card stack">
      <h3 class="card-title">Volume per workout</h3>
      {#if recentVolume.length === 0}
        <p class="empty">No completed workouts yet</p>
      {:else}
        {#each recentVolume as point (point.sessionId)}
          <div class="volume-row">
            <div class="volume-meta">
              <span>{point.title}</span>
              <span class="muted">
                {new Date(point.startedAt).toLocaleDateString()}
              </span>
            </div>
            <div class="volume-track" aria-hidden="true">
              <div class="volume-fill" style={`width: ${point.percent}%`}></div>
            </div>
            <span class="volume-value">
              {Math.round(point.totalVolumeKg)} kg
            </span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</section>
