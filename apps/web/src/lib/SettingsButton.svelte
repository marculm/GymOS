<script lang="ts">
  import { Settings } from "lucide-svelte";
  import { settings } from "$lib/settings.svelte.ts";
</script>

<button
  type="button"
  class="settings-button"
  aria-label="Settings"
  onclick={() => settings.show()}
>
  <Settings size={22} strokeWidth={1.8} aria-hidden="true" />
</button>
