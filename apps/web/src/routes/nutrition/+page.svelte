<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import SettingsButton from "$lib/SettingsButton.svelte";
  import { goToSpace, prefetchSpace, spaceSwipe } from "$lib/space.ts";
  import {
    lightThemeColor,
    trainingThemeColor,
  } from "$lib/theme-color.ts";
  import NutritionHome from "../../features/nutrition/NutritionHome.svelte";
  import NutritionLogFlow from "../../features/nutrition/NutritionLogFlow.svelte";

  let logOpen = $state(false);
  let logView = $state<"choice" | "today">("choice");

  onMount(() => {
    lightThemeColor();
    prefetchSpace("training");
  });
  onDestroy(trainingThemeColor);

  function openLog() {
    logView = "choice";
    logOpen = true;
  }

  function openToday() {
    logView = "today";
    logOpen = true;
  }
</script>

<div
  class="space-screen light-space nutrition-space"
  use:spaceSwipe={{ onSwipeRight: () => goToSpace("training") }}
>
  <SettingsButton />
  <NutritionHome onLogFood={openLog} onToday={openToday} />
  <NutritionLogFlow bind:open={logOpen} initialView={logView} />
</div>
