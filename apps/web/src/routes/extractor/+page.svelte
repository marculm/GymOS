<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { ChevronLeft, Sparkles } from "lucide-svelte";
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
  class="space-screen light-space"
  use:spaceSwipe={{ onSwipeRight: () => goToSpace("training") }}
>
  <SettingsButton />

  <div class="space-column nutrition-body">
    <div class="nutrition-hero">
      <p class="start-eyebrow">Recipes</p>
      <h1 class="nutrition-title">AI Extractor</h1>
      <p class="nutrition-meta">Recipes from TikTok and Reels.</p>
    </div>

    <div class="nutrition-empty">
      <div class="nutrition-icon">
        <Sparkles size={30} aria-hidden="true" />
      </div>
      <p class="nutrition-coming">TikTok / Reels AI Extractor</p>
      <p class="nutrition-copy">
        Import recipes and ingredients directly from video URLs.
      </p>
    </div>

    <button
      type="button"
      class="space-hint"
      aria-label="Go to Training"
      onclick={() => goToSpace("training")}
    >
      <ChevronLeft size={14} aria-hidden="true" />
      <span>Training</span>
    </button>
  </div>
</div>
