<script lang="ts">
import { ChevronLeft, ChevronRight, X } from "lucide-svelte";
import type { NutritionLogEntry, Recipe } from "@gymos/shared";
import { settings } from "$lib/settings.svelte.ts";
import { nutritionData } from "./nutrition-data.svelte.ts";

type View = "choice" | "saved" | "focus" | "today";

let {
  open = $bindable(false),
  initialView = "choice",
}: {
  open?: boolean;
  initialView?: "choice" | "today";
} = $props();

let dialog = $state<HTMLDialogElement | null>(null);
let view = $state<View>("choice");
let backTarget = $state<View>("choice");
let editing = $state<NutritionLogEntry | null>(null);
let recipeId = $state<string | null>(null);
let portion = $state(1);
let name = $state("");
let calories = $state<number | null>(0);
let proteinGrams = $state<number | null>(0);
let carbsGrams = $state<number | null>(0);
let fatGrams = $state<number | null>(0);
let pending = $state(false);
let error = $state<string | null>(null);
let confirmDelete = $state(false);

$effect(() => {
  if (!dialog) return;
  if (open && !dialog.open) {
    view = initialView;
    resetDraft();
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
  }
});

function resetDraft() {
  editing = null;
  recipeId = null;
  portion = 1;
  name = "";
  calories = 0;
  proteinGrams = 0;
  carbsGrams = 0;
  fatGrams = 0;
  error = null;
  confirmDelete = false;
}

function close() {
  open = false;
}

function manageRecipes() {
  settings.show("recipes");
  close();
}

function back() {
  if (view === "focus") {
    view = backTarget;
  } else if (view === "saved") {
    view = "choice";
  }
}

function startManual() {
  backTarget = "choice";
  resetDraft();
  view = "focus";
}

function startRecipe(recipe: Recipe) {
  backTarget = "saved";
  resetDraft();
  editing = null;
  recipeId = recipe.id;
  portion = 1;
  name = recipe.title;
  applyRecipe(recipe, 1);
  view = "focus";
}

function startEdit(entry: NutritionLogEntry) {
  backTarget = "today";
  resetDraft();
  editing = entry;
  name = entry.name;
  calories = entry.macros.calories;
  proteinGrams = entry.macros.proteinGrams;
  carbsGrams = entry.macros.carbsGrams;
  fatGrams = entry.macros.fatGrams;
  view = "focus";
}

function applyRecipe(recipe: Recipe, nextPortion: number) {
  calories = recipe.macrosPerServing.calories * nextPortion;
  proteinGrams = recipe.macrosPerServing.proteinGrams * nextPortion;
  carbsGrams = recipe.macrosPerServing.carbsGrams * nextPortion;
  fatGrams = recipe.macrosPerServing.fatGrams * nextPortion;
}

function changePortion(delta: number) {
  if (!recipeId) return;
  const recipe = nutritionData.recipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  portion = Math.min(4, Math.max(0.5, portion + delta));
  applyRecipe(recipe, portion);
}

const portionLabel = $derived(
  portion === 1 ? "1 serving" : `${format(portion)} servings`
);

function format(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const source = $derived(
  editing
    ? "Edit meal"
    : recipeId
      ? "Saved meal"
      : "Manual entry"
);

async function handleSave() {
  if (pending) return;
  const title = name.trim();
  const macros = {
    calories: calories ?? Number.NaN,
    proteinGrams: proteinGrams ?? Number.NaN,
    carbsGrams: carbsGrams ?? Number.NaN,
    fatGrams: fatGrams ?? Number.NaN,
  };
  if (!title) {
    error = "Enter a meal name.";
    return;
  }
  if (
    Object.values(macros).some(
      (value) => !Number.isFinite(value) || value < 0
    )
  ) {
    error = "Enter macros of zero or more.";
    return;
  }

  pending = true;
  error = null;
  try {
    if (editing) {
      await nutritionData.updateEntry(editing.id, { name: title, macros });
    } else {
      await nutritionData.log({ name: title, macros });
    }
    open = false;
  } catch (saveError) {
    error =
      saveError instanceof Error ? saveError.message : "Could not log the meal";
  } finally {
    pending = false;
  }
}

async function handleDelete() {
  if (!editing || pending) return;
  pending = true;
  error = null;
  try {
    await nutritionData.removeEntry(editing.id);
    open = false;
  } catch (deleteError) {
    error =
      deleteError instanceof Error
        ? deleteError.message
        : "Could not delete the meal";
  } finally {
    pending = false;
  }
}

function handleClose() {
  open = false;
}
</script>

<dialog
  bind:this={dialog}
  class={`nutrition-log-dialog light-space ${view === "choice" ? "choice" : "full"}`}
  onclose={handleClose}
  aria-label="Log food"
>
  {#if view === "choice"}
    <div class="nutrition-choice">
      <div class="sheet-grabber"></div>
      <div class="sheet-head">
        <h2>Log food</h2>
        <button type="button" class="icon-btn muted" aria-label="Close" onclick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div class="group nutrition-choice-group">
        <button type="button" class="list-row nutrition-option" onclick={() => (view = "saved")}>
          <span class="nutrition-option-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
            </svg>
          </span>
          <span class="list-main">
            <span class="list-title">Saved meal</span>
            <span class="list-subtitle">Log a portion from your recipes.</span>
          </span>
          <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
        </button>
        <button type="button" class="list-row nutrition-option" onclick={startManual}>
          <span class="nutrition-option-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="list-main">
            <span class="list-title">Describe</span>
            <span class="list-subtitle">Enter the meal and macros manually.</span>
          </span>
          <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
        </button>
      </div>
      <p class="settings-note">
        Saved meals use the recipe values. The estimate for Describe comes in a later
        slice; for now you enter the macros.
      </p>
      <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
    </div>
  {:else if view === "saved"}
    <div class="nutrition-full">
      <header class="nutrition-full-head">
        <button type="button" class="icon-btn muted" aria-label="Back" onclick={back}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 class="nutrition-full-title">Saved meals</h2>
        <button type="button" class="icon-btn muted" aria-label="Close" onclick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div class="nutrition-full-body">
        {#if nutritionData.recipes.length === 0}
          <div class="nutrition-log-empty">
            <p>No saved meals yet.</p>
            <p class="muted">Recipes you save will appear here for one-tap logging.</p>
          </div>
        {:else}
          <div class="group">
            {#each nutritionData.recipes as recipe (recipe.id)}
              <button type="button" class="list-row" onclick={() => startRecipe(recipe)}>
                <span class="list-main">
                  <span class="list-title">{recipe.title}</span>
                  <span class="list-subtitle">
                    {format(recipe.macrosPerServing.calories)} kcal per serving
                  </span>
                </span>
                <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="nutrition-full-actions">
        <button type="button" class="btn btn-ghost" onclick={manageRecipes}>
          Manage recipes
        </button>
      </div>
    </div>
  {:else if view === "focus"}
    <div class="nutrition-focus">
      <div class="nutrition-focus-top">
        <button type="button" class="icon-btn muted" aria-label="Back" onclick={back}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span class="nutrition-focus-label">Log meal</span>
        <button type="button" class="icon-btn muted" aria-label="Close" onclick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <input
        class="nutrition-focus-name"
        maxlength={120}
        placeholder="Meal name"
        aria-label="Meal name"
        bind:value={name}
      />
      <p class="nutrition-focus-source">{source}</p>

      {#if recipeId}
        <div class="nutrition-portion">
          <span>Portion</span>
          <div class="nutrition-stepper">
            <button type="button" aria-label="Less" onclick={() => changePortion(-0.5)}>−</button>
            <b>{portionLabel}</b>
            <button type="button" aria-label="More" onclick={() => changePortion(0.5)}>+</button>
          </div>
        </div>
      {/if}

      <div class="nutrition-metrics">
        <label class="nutrition-metric">
          <span class="nutrition-metric-label">Calories</span>
          <span class="nutrition-metric-value">
            <input type="number" min="0" step="any" inputmode="decimal" bind:value={calories} aria-label="Calories" />
            <small>kcal</small>
          </span>
        </label>
        <label class="nutrition-metric">
          <span class="nutrition-metric-label"><i class="dot p"></i>Protein</span>
          <span class="nutrition-metric-value">
            <input type="number" min="0" step="any" inputmode="decimal" bind:value={proteinGrams} aria-label="Protein grams" />
            <small>g</small>
          </span>
        </label>
        <label class="nutrition-metric">
          <span class="nutrition-metric-label"><i class="dot c"></i>Carbs</span>
          <span class="nutrition-metric-value">
            <input type="number" min="0" step="any" inputmode="decimal" bind:value={carbsGrams} aria-label="Carbs grams" />
            <small>g</small>
          </span>
        </label>
        <label class="nutrition-metric">
          <span class="nutrition-metric-label"><i class="dot f"></i>Fat</span>
          <span class="nutrition-metric-value">
            <input type="number" min="0" step="any" inputmode="decimal" bind:value={fatGrams} aria-label="Fat grams" />
            <small>g</small>
          </span>
        </label>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <div class="nutrition-focus-actions">
        <button
          type="button"
          class="nutrition-primary"
          disabled={pending}
          onclick={() => void handleSave()}
        >
          {editing ? "Save changes" : "Log meal"}
        </button>
        <button type="button" class="nutrition-secondary" onclick={close}>Cancel</button>
        {#if editing}
          {#if confirmDelete}
            <div class="nutrition-confirm">
              <span>Delete this meal?</span>
              <button type="button" class="btn btn-danger" disabled={pending} onclick={() => void handleDelete()}>
                Delete
              </button>
              <button type="button" class="btn btn-ghost" onclick={() => (confirmDelete = false)}>
                Keep
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="nutrition-delete"
              onclick={() => (confirmDelete = true)}
            >
              Delete meal
            </button>
          {/if}
        {/if}
      </div>
    </div>
  {:else}
    <div class="nutrition-full">
      <header class="nutrition-full-head">
        <h2 class="nutrition-full-title">Today's log</h2>
        <button type="button" class="icon-btn muted" aria-label="Close" onclick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div class="nutrition-full-body">
        <p class="nutrition-log-summary">
          {nutritionData.entries.length}
          {nutritionData.entries.length === 1 ? "meal" : "meals"},
          {format(nutritionData.summary?.totals.calories ?? 0)} kcal
        </p>
        {#if nutritionData.entries.length === 0}
          <div class="nutrition-log-empty">
            <p>No meals logged today.</p>
            <button type="button" class="btn btn-ghost" onclick={() => (view = "choice")}>
              Log food
            </button>
          </div>
        {:else}
          <div class="group">
            {#each nutritionData.entries as entry (entry.id)}
              <button type="button" class="list-row" onclick={() => startEdit(entry)}>
                <span class="nutrition-entry-time">{formatTime(entry.loggedAt)}</span>
                <span class="list-main">
                  <span class="list-title">{entry.name}</span>
                  <span class="list-subtitle">
                    {format(entry.macros.proteinGrams)}P {format(entry.macros.carbsGrams)}C
                    {format(entry.macros.fatGrams)}F
                  </span>
                </span>
                <span class="nutrition-entry-kcal">{format(entry.macros.calories)}</span>
                <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="nutrition-full-actions">
        <button type="button" class="nutrition-secondary" onclick={close}>Done</button>
      </div>
    </div>
  {/if}
</dialog>
