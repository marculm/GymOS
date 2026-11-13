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
  let cancelButton = $state<HTMLButtonElement | null>(null);
  let closed = false;

  onMount(() => {
    dialog?.showModal();
    dialog?.focus();
  });

  $effect(() => {
    if (pending) cancelButton?.focus();
  });

  function start(input: { planId?: string }) {
    if (pending) return;
    onStart(input);
  }

  function notifyClose() {
    if (closed) return;
    closed = true;
    onClose();
  }

  function close() {
    if (dialog?.open) dialog.close();
    notifyClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    const rect = dialog?.getBoundingClientRect();
    if (!rect) return;

    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) close();
  }
</script>

<dialog
  bind:this={dialog}
  class="card picker"
  tabindex="-1"
  aria-labelledby="workout-picker-title"
  onclick={handleBackdropClick}
  onclose={notifyClose}
>
  <div class="stack">
    <div class="row">
      <h2 class="card-title grow" id="workout-picker-title">
        Choose a workout
      </h2>
      <button
        bind:this={cancelButton}
        type="button"
        class="btn btn-ghost"
        onclick={close}
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
