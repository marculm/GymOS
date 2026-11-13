<script lang="ts">
  import { onMount } from "svelte";
  import SettingsSheet from "$lib/SettingsSheet.svelte";
  import { registerSW } from "virtual:pwa-register";
  import "../styles.css";

  let { children } = $props();

  onMount(() => {
    registerSW({ immediate: true });
  });
</script>

{@render children()}
<SettingsSheet />
