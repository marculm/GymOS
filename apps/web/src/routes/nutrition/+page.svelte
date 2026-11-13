<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { ChevronLeft, Utensils } from "lucide-svelte";
  import SettingsButton from "$lib/SettingsButton.svelte";
  import { goToSpace, spaceSwipe } from "$lib/space.ts";
  import {
    lightThemeColor,
    trainingThemeColor,
  } from "$lib/theme-color.ts";

  onMount(lightThemeColor);
  onDestroy(trainingThemeColor);
</script>

<div
  class="space-screen light-space nutrition-space"
  use:spaceSwipe={{ onSwipeRight: () => goToSpace("training") }}
>
  <SettingsButton />

  <div class="space-column nutrition-body">
    <div class="nutrition-hero">
      <p class="start-eyebrow">Food</p>
      <h1 class="nutrition-title">Nutrition</h1>
      <p class="nutrition-meta">Macros, meals, mealprep.</p>
    </div>

    <div class="nutrition-empty">
      <div class="nutrition-icon">
        <Utensils size={30} aria-hidden="true" />
      </div>
      <p class="nutrition-coming">Coming soon</p>
      <p class="nutrition-copy">Log meals and macros here.</p>
    </div>

    <button
      type="button"
      class="space-hint"
      aria-label="Go to Training"
      onclick={() => goToSpace("training")}
    >
      <ChevronLeft size={14} aria-hidden="true" />
      <span>Training</span>
      <span class="dots" aria-hidden="true"><i></i><i class="on"></i></span>
    </button>
  </div>
</div>
