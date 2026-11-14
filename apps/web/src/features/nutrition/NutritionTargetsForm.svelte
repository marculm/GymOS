<script lang="ts">
import { onMount } from "svelte";
import type { Macros } from "@gymos/shared";
import { getTargets } from "../../api/nutrition.mts";
import { nutritionData } from "./nutrition-data.svelte.ts";

let values = $state({
  calories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatGrams: "",
});
let loading = $state(true);
let pending = $state(false);
let error = $state<string | null>(null);
let saved = $state(false);

onMount(() => {
  void load();
});

async function load() {
  loading = true;
  error = null;
  try {
    const targets =
      nutritionData.summary?.targets ?? (await getTargets());
    if (targets) {
      values = {
        calories: String(targets.calories),
        proteinGrams: String(targets.proteinGrams),
        carbsGrams: String(targets.carbsGrams),
        fatGrams: String(targets.fatGrams),
      };
    }
  } catch (loadError) {
    error =
      loadError instanceof Error ? loadError.message : "Could not load targets";
  } finally {
    loading = false;
  }
}

function parseTargets(): Macros | null {
  const calories = Number(values.calories);
  const proteinGrams = Number(values.proteinGrams);
  const carbsGrams = Number(values.carbsGrams);
  const fatGrams = Number(values.fatGrams);
  const numbers = [calories, proteinGrams, carbsGrams, fatGrams];
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  if (calories <= 0) return null;
  return { calories, proteinGrams, carbsGrams, fatGrams };
}

async function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (pending) return;
  const targets = parseTargets();
  if (!targets) {
    error = "Enter a calorie target above zero and macros of zero or more.";
    return;
  }

  pending = true;
  error = null;
  saved = false;
  try {
    await nutritionData.saveTargets(targets);
    saved = true;
  } catch (saveError) {
    error =
      saveError instanceof Error ? saveError.message : "Could not save targets";
  } finally {
    pending = false;
  }
}
</script>

<form class="stack" onsubmit={handleSubmit}>
  <h3 class="card-title form-title">Your targets</h3>
  <div class="form-rows">
    <label class="field">
      <span class="label">Calories</span>
      <input
        class="input"
        type="number"
        min="0"
        step="any"
        required
        placeholder="2400"
        bind:value={values.calories}
      />
    </label>
    <label class="field">
      <span class="label">Protein</span>
      <input
        class="input"
        type="number"
        min="0"
        step="any"
        required
        placeholder="160"
        bind:value={values.proteinGrams}
      />
    </label>
    <label class="field">
      <span class="label">Carbs</span>
      <input
        class="input"
        type="number"
        min="0"
        step="any"
        required
        placeholder="260"
        bind:value={values.carbsGrams}
      />
    </label>
    <label class="field">
      <span class="label">Fat</span>
      <input
        class="input"
        type="number"
        min="0"
        step="any"
        required
        placeholder="75"
        bind:value={values.fatGrams}
      />
    </label>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  {#if saved}
    <p class="form-note">Targets saved.</p>
  {/if}

  <div class="form-actions">
    <button class="btn btn-primary" type="submit" disabled={pending || loading}>
      Save targets
    </button>
  </div>
</form>
