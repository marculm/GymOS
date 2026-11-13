<script lang="ts">
  import GymView from "$features/gym/GymView.svelte";
  import { shell } from "$lib/shell.svelte.ts";

  function handleSessionActive(active: boolean) {
    shell.sessionActive = active;
  }
</script>

<GymView onSessionActiveChange={handleSessionActive} />
