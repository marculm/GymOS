<script lang="ts">
import { tick } from "svelte";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-svelte";
import type { NutritionLogEntry, Recipe } from "@gymos/shared";
import { goto } from "$app/navigation";
import { nutritionData } from "./nutrition-data.svelte.ts";
import { compressMealPhoto } from "./meal-photo.mts";

type View = "choice" | "describe" | "saved" | "focus" | "today";

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
let description = $state("");
let estimated = $state(false);
let descriptionInput = $state<HTMLTextAreaElement | null>(null);
let photoInput = $state<HTMLInputElement | null>(null);
let photo = $state<string | null>(null);
let preparingPhoto = $state(false);
let photoRun = 0;
let calories = $state<number | null>(0);
let proteinGrams = $state<number | null>(0);
let carbsGrams = $state<number | null>(0);
let fatGrams = $state<number | null>(0);
let pending = $state(false);
let error = $state<string | null>(null);
let confirmDelete = $state(false);
let estimateRun = 0;

$effect(() => {
  if (!dialog) return;
  if (open && !dialog.open) {
    view = initialView;
    resetDraft();
    dialog.showModal();
    dialog.focus();
  } else if (!open && dialog.open) {
    dialog.close();
  }
});

function resetDraft() {
  estimateRun += 1;
  photoRun += 1;
  pending = false;
  preparingPhoto = false;
  editing = null;
  recipeId = null;
  portion = 1;
  name = "";
  description = "";
  photo = null;
  estimated = false;
  calories = 0;
  proteinGrams = 0;
  carbsGrams = 0;
  fatGrams = 0;
  error = null;
  confirmDelete = false;
}

function close() {
  handleClose();
}

function manageRecipes() {
  close();
  void goto("/nutrition/recipes");
}

function back() {
  if (view === "focus") {
    view = backTarget;
  } else if (view === "saved" || view === "describe") {
    if (view === "describe") {
      estimateRun += 1;
      pending = false;
    }
    view = "choice";
  }
}

async function startDescribe() {
  backTarget = "choice";
  resetDraft();
  view = "describe";
  await tick();
  descriptionInput?.focus();
}

function startManualFromDescribe() {
  const text = description;
  backTarget = "describe";
  resetDraft();
  description = text;
  name = text.trim().slice(0, 120);
  view = "focus";
}

async function choosePhoto(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || pending) return;

  const run = photoRun + 1;
  photoRun = run;
  preparingPhoto = true;
  error = null;
  try {
    const image = await compressMealPhoto(file);
    if (run === photoRun) photo = image;
  } catch {
    if (run === photoRun) error = "Could not read the photo.";
  } finally {
    if (run === photoRun) preparingPhoto = false;
  }
}

function removePhoto() {
  if (pending) return;
  photo = null;
}

async function estimate() {
  if (pending) return;
  const text = description.trim();
  if (!text && !photo) {
    error = "Describe the meal or add a photo first.";
    return;
  }

  const run = estimateRun + 1;
  estimateRun = run;
  pending = true;
  error = null;
  try {
    const result = await nutritionData.estimate({
      ...(text ? { description: text } : {}),
      ...(photo ? { image: photo } : {}),
    });
    if (run !== estimateRun) return;
    editing = null;
    recipeId = null;
    name = result.name ?? (text ? text.slice(0, 120) : "Photo meal");
    calories = result.macros.calories;
    proteinGrams = result.macros.proteinGrams;
    carbsGrams = result.macros.carbsGrams;
    fatGrams = result.macros.fatGrams;
    estimated = true;
    backTarget = "describe";
    view = "focus";
  } catch (estimateError) {
    if (run !== estimateRun) return;
    error =
      estimateError instanceof Error
        ? estimateError.message
        : "Could not estimate the meal";
  } finally {
    if (run === estimateRun) pending = false;
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
      : estimated
        ? "AI estimate"
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
  estimateRun += 1;
  pending = false;
  open = false;
}
</script>

<dialog
  bind:this={dialog}
  class={`nutrition-log-dialog light-space ${view === "choice" ? "choice" : "full"}`}
  tabindex="-1"
  onclose={handleClose}
  aria-label="Log food"
>
  {#if view === "choice"}
    <div class="nutrition-choice">
      <div class="sheet-grabber"></div>
      <div class="sheet-head">
        <h2>Log food</h2>
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
        <button type="button" class="list-row nutrition-option" onclick={startDescribe}>
          <span class="nutrition-option-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="list-main">
            <span class="list-title">Describe</span>
            <span class="list-subtitle">Let AI estimate the meal from a description.</span>
          </span>
          <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
        </button>
        <button type="button" class="list-row nutrition-option" onclick={startManual}>
          <span class="nutrition-option-icon">
            <Pencil size={19} aria-hidden="true" />
          </span>
          <span class="list-main">
            <span class="list-title">Manual</span>
            <span class="list-subtitle">Enter the meal and macros yourself.</span>
          </span>
          <ChevronRight size={17} class="settings-chevron" aria-hidden="true" />
        </button>
      </div>
      <p class="settings-note">
        Saved meals use recipe values. An AI estimate fills the logger; you can edit
        everything before logging.
      </p>
      <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
    </div>
  {:else if view === "describe"}
    <div class="nutrition-full">
      <header class="nutrition-full-head">
        <button type="button" class="icon-btn muted" aria-label="Back" onclick={back}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 class="nutrition-full-title">Describe</h2>
        <button type="button" class="icon-btn muted" aria-label="Close" onclick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div class="nutrition-full-body nutrition-describe">
        <label class="nutrition-describe-label" for="meal-description">
          Meal description
        </label>
        <textarea
          id="meal-description"
          class="nutrition-describe-input"
          maxlength={2000}
          disabled={pending}
          placeholder="e.g. Big Mac, medium fries and a Coke"
          bind:this={descriptionInput}
          bind:value={description}
        ></textarea>
        <p class="nutrition-describe-hint">
          Include portions when you know them, and add a photo if it helps. The
          estimate fills the logger; you can edit every value.
        </p>
        <input
          bind:this={photoInput}
          class="nutrition-photo-input"
          type="file"
          accept="image/*"
          aria-label="Meal photo"
          disabled={pending || preparingPhoto}
          onchange={(event) => void choosePhoto(event)}
        />
        {#if photo}
          <img
            class="nutrition-photo-preview"
            src={photo}
            alt="Selected meal"
          />
          <button
            type="button"
            class="nutrition-secondary"
            disabled={pending}
            onclick={removePhoto}
          >
            Remove photo
          </button>
        {:else}
          <button
            type="button"
            class="nutrition-secondary"
            disabled={pending || preparingPhoto}
            onclick={() => photoInput?.click()}
          >
            {preparingPhoto ? "Preparing photo…" : "Add photo"}
          </button>
        {/if}
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}
      </div>
      <div class="nutrition-full-actions nutrition-describe-actions">
        <button
          type="button"
          class="nutrition-primary"
          disabled={pending ||
            preparingPhoto ||
            (description.trim().length === 0 && !photo)}
          aria-busy={pending}
          onclick={() => void estimate()}
        >
          {pending ? "Estimating…" : "Estimate"}
        </button>
        <button
          type="button"
          class="nutrition-secondary"
          disabled={pending}
          onclick={startManualFromDescribe}
        >
          Enter manually
        </button>
      </div>
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
        <button type="button" class="nutrition-secondary" onclick={manageRecipes}>
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
