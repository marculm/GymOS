<script lang="ts">
  import type { Snippet } from "svelte";
  import { X } from "lucide-svelte";

  let {
    open,
    title,
    onClose,
    children,
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: Snippet;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="session-sheet"
  tabindex="-1"
  aria-label={title}
  onclose={onClose}
>
  <div class="sheet-grabber" aria-hidden="true"></div>
  <header class="sheet-head">
    <h2>{title}</h2>
    <button
      type="button"
      class="icon-btn muted"
      aria-label="Close"
      onclick={onClose}
    >
      <X size={20} aria-hidden="true" />
    </button>
  </header>
  <div class="sheet-body">
    {@render children()}
  </div>
</dialog>
