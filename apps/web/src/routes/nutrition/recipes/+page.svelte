<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { ChevronLeft } from "lucide-svelte";
  import SettingsButton from "$lib/SettingsButton.svelte";
  import { prefetchSpace, spaceSwipe } from "$lib/space.ts";
  import {
    lightThemeColor,
    trainingThemeColor,
  } from "$lib/theme-color.ts";
  import RecipesManager from "../../../features/nutrition/RecipesManager.svelte";

  let editing = $state(false);
  let viewing = $state(false);
  let closeDetail: (() => void) | null = null;

  function back() {
    if (viewing) {
      closeDetail?.();
      return;
    }
    void goto("/nutrition", { replaceState: true });
  }

  onMount(() => {
    lightThemeColor();
    prefetchSpace("training");
  });
  onDestroy(trainingThemeColor);
</script>

<div
  class="space-screen light-space nutrition-space"
  use:spaceSwipe={{
    onSwipeRight: editing
      ? undefined
      : () => void goto("/nutrition", { replaceState: true }),
  }}
>
  <SettingsButton />
  <div class="space-column nutrition-body">
    <button type="button" class="recipe-back" onclick={back}>
      <ChevronLeft size={18} aria-hidden="true" />
      {viewing ? "Recipes" : "Nutrition"}
    </button>

    <div class="nutrition-hero recipes-hero">
      <p class="start-eyebrow">Nutrition</p>
      {#if !viewing}
        <h1 class="nutrition-title">Recipes</h1>
        <p class="nutrition-meta">Saved recipes with macros per serving.</p>
      {/if}
    </div>

    <RecipesManager
      onEditingChange={(value) => (editing = value)}
      onViewingChange={(value) => (viewing = value)}
      onBackReady={(close) => (closeDetail = close)}
    />
  </div>
</div>
