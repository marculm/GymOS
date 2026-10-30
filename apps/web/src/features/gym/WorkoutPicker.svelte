<script lang="ts">
  import { onMount } from "svelte";
  import type { WorkoutPlan } from "@gymos/shared";

  let {
    plans,
    pending = false,
    error = null,
    onStart,
    onClose,
  }: {
    plans: WorkoutPlan[];
    pending?: boolean;
    error?: string | null;
    onStart: (input: { planId?: string }) => void;
    onClose: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  onMount(() => {
    dialog?.showModal();
  });

  function start(input: { planId?: string }) {
    if (pending) return;
    onStart(input);
  }
</script>

<dialog
  bind:this={dialog}
  class="card picker"
  aria-labelledby="workout-picker-title"
  onclick={(event) => {
    if (event.target === dialog) onClose();
  }}
  oncancel={(event) => {
    event.preventDefault();
    onClose();
  }}
>
  <div class="stack">
    <div class="row">
      <h2 class="card-title grow" id="workout-picker-title">
        Choose a workout
      </h2>
      <button
        type="button"
        class="btn btn-ghost"
        disabled={pending}
        onclick={onClose}
      >
        Cancel
      </button>
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if plans.length === 0}
      <p class="empty">No plans yet</p>
    {/if}

    {#each plans as plan (plan.id)}
      <button
        type="button"
        class="btn btn-ghost picker-option"
        disabled={pending}
        onclick={() => start({ planId: plan.id })}
      >
        <span class="grow">{plan.name}</span>
        <span class="muted">
          {plan.exercises.length}
          {plan.exercises.length === 1 ? "exercise" : "exercises"}
        </span>
      </button>
    {/each}

    <button
      type="button"
      class="btn btn-ghost picker-option"
      disabled={pending}
      onclick={() => start({})}
    >
      <span class="grow">Free workout</span>
      <span class="muted">No plan</span>
    </button>

    {#if pending}
      <p class="muted" role="status">Starting workout…</p>
    {/if}
  </div>
</dialog>
