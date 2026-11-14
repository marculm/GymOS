<script lang="ts">
import { Beef, Droplet, Wheat } from "lucide-svelte";
import { onMount } from "svelte";
import type { Macros } from "@gymos/shared";
import { settings } from "$lib/settings.svelte.ts";
import { goToSpace } from "$lib/space.ts";
import { nutritionData } from "./nutrition-data.svelte.ts";

let {
  onLogFood,
  onToday,
}: {
  onLogFood: () => void;
  onToday: () => void;
} = $props();

const CIRCUMFERENCE = 2 * Math.PI * 84;
const GAUGE_SPAN = CIRCUMFERENCE * 0.75;
const GAP = 3;
const MACROS = [
  { key: "p", name: "Protein", calories: 4 },
  { key: "c", name: "Carbs", calories: 4 },
  { key: "f", name: "Fat", calories: 9 },
] as const;

onMount(() => {
  void nutritionData.load();
});

const summary = $derived(nutritionData.summary);

function format(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

const segments = $derived.by(() => {
  const current = summary;
  if (!current?.targets || current.targets.calories <= 0) return [];
  const targets = current.targets;
  const targetCalories = targets.calories;
  const raw = MACROS.map((macro) => {
    const grams =
      macro.key === "p"
        ? current.totals.proteinGrams
        : macro.key === "c"
          ? current.totals.carbsGrams
          : current.totals.fatGrams;
    return (grams * macro.calories) / targetCalories;
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  const factor = total > 1 ? 1 / total : 1;
  let cursor = 0;

  return MACROS.map((macro, index) => {
    const full = (raw[index] ?? 0) * factor * GAUGE_SPAN;
    const drawn = Math.max(0, full - GAP);
    const offset = -(cursor + GAP / 2);
    cursor += full;
    const grams =
      macro.key === "p"
        ? current.totals.proteinGrams
        : macro.key === "c"
          ? current.totals.carbsGrams
          : current.totals.fatGrams;
    const target =
      macro.key === "p"
        ? targets.proteinGrams
        : macro.key === "c"
          ? targets.carbsGrams
          : targets.fatGrams;
    return {
      key: macro.key,
      dash: `${drawn} ${CIRCUMFERENCE - drawn}`,
      offset,
      over: target > 0 && grams >= target,
    };
  });
});

const remaining = $derived(
  summary?.targets
    ? {
        calories: summary.targets.calories - summary.totals.calories,
        proteinGrams: summary.targets.proteinGrams - summary.totals.proteinGrams,
        carbsGrams: summary.targets.carbsGrams - summary.totals.carbsGrams,
        fatGrams: summary.targets.fatGrams - summary.totals.fatGrams,
      }
    : null
);

const overCalories = $derived(remaining !== null && remaining.calories < 0);

function targetValue(target: Macros | null, key: string): number {
  if (!target) return 0;
  return key === "p"
    ? target.proteinGrams
    : key === "c"
      ? target.carbsGrams
      : target.fatGrams;
}

function remainingValue(key: string): number {
  if (!remaining) return 0;
  return key === "p"
    ? remaining.proteinGrams
    : key === "c"
      ? remaining.carbsGrams
      : remaining.fatGrams;
}

function eatenValue(key: string): number {
  if (!summary) return 0;
  return key === "p"
    ? summary.totals.proteinGrams
    : key === "c"
      ? summary.totals.carbsGrams
      : summary.totals.fatGrams;
}

function barWidth(key: string): number {
  if (!summary?.targets) return 0;
  const target = targetValue(summary.targets, key);
  if (target <= 0) return 0;
  return Math.min(100, (eatenValue(key) / target) * 100);
}

function isOver(key: string): boolean {
  return remainingValue(key) < 0;
}

function retry() {
  void nutritionData.load(true);
}
</script>

<div class="space-column nutrition-home">
  <div class="start-top">
    <p class="start-eyebrow">Today</p>
  </div>

  <div class="nutrition-title-block">
    <h1 class="nutrition-title">Nutrition</h1>
    {#if summary?.targets}
      <p class="nutrition-meta">
        {format(summary.totals.calories)} of {format(summary.targets.calories)} kcal eaten
      </p>
    {/if}
  </div>

  {#if nutritionData.loading}
    <div class="nutrition-state">
      <p class="muted">Loading…</p>
    </div>
  {:else if nutritionData.error}
    <div class="nutrition-state">
      <p class="error" role="alert">{nutritionData.error}</p>
      <button type="button" class="btn btn-ghost" onclick={retry}>Retry</button>
    </div>
  {:else if !summary?.targets}
    <div class="nutrition-setup">
      <p class="nutrition-setup-title">Set your daily targets</p>
      <p class="nutrition-copy">
        Add calories and macros once. Today's gauge and remaining values are built from
        them.
      </p>
      <button
        type="button"
        class="nutrition-primary"
        onclick={() => settings.show("targets")}
      >
        Set daily targets
      </button>
    </div>
  {:else}
    <div class="nutrition-gauge-wrap">
      <svg class="nutrition-gauge" viewBox="0 0 200 200" role="img" aria-label="Calories eaten today as a gauge">
        <g transform="rotate(135 100 100)">
          <circle class="nutrition-gauge-track" cx="100" cy="100" r="84" stroke-dasharray={`${GAUGE_SPAN} ${CIRCUMFERENCE - GAUGE_SPAN}`} />
          {#each segments as segment (segment.key)}
            <circle
              class={`nutrition-gauge-seg ${segment.key}${segment.over ? " over" : ""}`}
              cx="100"
              cy="100"
              r="84"
              stroke-dasharray={segment.dash}
              stroke-dashoffset={segment.offset}
            />
          {/each}
        </g>
      </svg>
      <div class="nutrition-gauge-center">
        <span class:over={overCalories} class="nutrition-gauge-num">
          {format(Math.abs(remaining?.calories ?? 0))}
        </span>
        <span class:over={overCalories} class="nutrition-gauge-label">
          {overCalories ? "kcal over" : "kcal left"}
        </span>
      </div>
    </div>

    <div class="nutrition-macro-strip">
      {#each MACROS as macro (macro.key)}
        <div class="nutrition-macro-col">
          <span class="nutrition-macro-label">
            <span class={`nutrition-macro-icon ${macro.key}`}>
              {#if macro.key === "p"}
                <Beef size={12} aria-hidden="true" />
              {:else if macro.key === "c"}
                <Wheat size={12} aria-hidden="true" />
              {:else}
                <Droplet size={12} aria-hidden="true" />
              {/if}
            </span>
            {macro.name}
          </span>
          <span class="nutrition-macro-value">
            {format(Math.abs(remainingValue(macro.key)))}
            <small>{remainingValue(macro.key) < 0 ? "g over" : "g left"}</small>
          </span>
          <span class="nutrition-macro-of">
            {format(eatenValue(macro.key))} of {format(targetValue(summary.targets, macro.key))} g
          </span>
          <span class="nutrition-macro-bar">
            <i
              class:over={isOver(macro.key)}
              class={macro.key}
              style={`width: ${barWidth(macro.key)}%`}
            ></i>
          </span>
        </div>
      {/each}
    </div>

    <div class="nutrition-actions">
      <button type="button" class="nutrition-primary" onclick={onLogFood}>Log food</button>
      <button type="button" class="nutrition-secondary" onclick={onToday}>Today's log</button>
    </div>
  {/if}

  <button
    type="button"
    class="space-hint"
    aria-label="Go to Training"
    onclick={() => goToSpace("training")}
  >
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    <span>Training</span>
    <span class="dots" aria-hidden="true"><i></i><i class="on"></i></span>
  </button>
</div>
