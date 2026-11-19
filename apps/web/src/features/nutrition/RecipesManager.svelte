<script lang="ts">
import { onMount, tick } from "svelte";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-svelte";
import type { Recipe, RecipeInput } from "@gymos/shared";
import RecipeDetail from "./RecipeDetail.svelte";
import RecipeForm from "./RecipeForm.svelte";
import { nutritionData } from "./nutrition-data.svelte.ts";

let {
  onEditingChange,
  onViewingChange,
  onBackReady,
}: {
  onEditingChange?: (editing: boolean) => void;
  onViewingChange?: (viewing: boolean) => void;
  onBackReady?: (close: () => void) => void;
} = $props();

let error = $state<string | null>(null);
let formOpen = $state(false);
let editing = $state<Recipe | null>(null);
let draft = $state<RecipeInput | null>(null);
let viewing = $state<Recipe | null>(null);
let importOpen = $state(false);
let importText = $state("");
let importPending = $state(false);
let importError = $state<string | null>(null);
let listScrollTop = 0;

onMount(() => {
  void load();
});

$effect(() => {
  onEditingChange?.(formOpen || importOpen);
});

$effect(() => {
  onViewingChange?.(viewing !== null);
});

$effect(() => {
  onBackReady?.(closeDetail);
});

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong";
}

async function load() {
  error = null;
  try {
    await nutritionData.loadRecipes();
  } catch (loadError) {
    error = messageOf(loadError);
  }
}

function openCreate() {
  editing = null;
  draft = null;
  error = null;
  formOpen = true;
}

function openEdit(recipe: Recipe) {
  editing = recipe;
  draft = null;
  error = null;
  formOpen = true;
}

function openImport() {
  draft = null;
  importText = "";
  importError = null;
  importOpen = true;
}

function cancelImport() {
  importOpen = false;
  importText = "";
  importError = null;
}

async function extract() {
  if (importPending) return;
  const text = importText.trim();
  if (!text) {
    importError = "Paste the recipe text first.";
    return;
  }

  importPending = true;
  importError = null;
  try {
    draft = await nutritionData.extractRecipe({ text });
    importOpen = false;
    importText = "";
    formOpen = true;
    editing = null;
  } catch (extractError) {
    importError = messageOf(extractError);
  } finally {
    importPending = false;
  }
}

async function openDetail(recipe: Recipe) {
  const scroller = document.querySelector<HTMLElement>(".space-screen");
  listScrollTop = scroller?.scrollTop ?? 0;
  viewing = recipe;
  await tick();
  scroller?.scrollTo({ top: 0 });
  document.getElementById("edit-recipe-detail")?.focus();
}

async function editViewed() {
  if (!viewing) return;
  const recipe = viewing;
  viewing = null;
  openEdit(recipe);
  await tick();
  document.querySelector<HTMLElement>(".space-screen")?.scrollTo({ top: 0 });
}

async function closeDetail() {
  const id = viewing?.id;
  viewing = null;
  await tick();
  document.querySelector<HTMLElement>(".space-screen")?.scrollTo({ top: listScrollTop });
  if (id) document.getElementById(`open-recipe-${id}`)?.focus();
}

async function close(focusId: string) {
  formOpen = false;
  editing = null;
  draft = null;
  await tick();
  document.getElementById(focusId)?.focus();
}

function cancel() {
  void close(editing ? `edit-recipe-${editing.id}` : "new-recipe-button");
}

async function handleSubmit(input: RecipeInput) {
  if (editing) {
    const id = editing.id;
    await nutritionData.saveRecipe(id, input);
    await close(`edit-recipe-${id}`);
    return;
  }
  const created = await nutritionData.saveRecipe(null, input);
  await close(`edit-recipe-${created.id}`);
}

async function handleDelete(recipe: Recipe) {
  if (!confirm(`Delete ${recipe.title}?`)) return;
  error = null;
  try {
    await nutritionData.removeRecipe(recipe.id);
  } catch (deleteError) {
    error = messageOf(deleteError);
  }
}

function format(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}
</script>

{#if viewing}
  <RecipeDetail recipe={viewing} onEdit={() => void editViewed()} />
{:else}
  <div class="group">
    {#if importOpen}
      <div class="group-form">
        <form
          class="stack"
          onsubmit={(event) => {
            event.preventDefault();
            void extract();
          }}
        >
          <h3 class="card-title form-title">Import from text</h3>
          <div class="form-rows">
            <label class="field field-block">
              <span class="label">Recipe text</span>
              <textarea
                class="input"
                rows="6"
                maxlength={8000}
                disabled={importPending}
                placeholder="Paste the recipe text"
                bind:value={importText}
              ></textarea>
            </label>
          </div>
          {#if importError}
            <p class="error" role="alert">{importError}</p>
          {/if}
          <div class="form-actions">
            <button
              class="btn btn-primary"
              type="submit"
              disabled={importPending || importText.trim().length === 0}
              aria-busy={importPending}
            >
              {importPending ? "Extracting…" : "Extract"}
            </button>
            <button
              class="btn btn-ghost"
              type="button"
              disabled={importPending}
              onclick={cancelImport}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    {/if}

    {#if formOpen}
      <div class="group-form">
        <RecipeForm
          recipe={editing}
          draft={draft}
          onSubmit={handleSubmit}
          onCancel={cancel}
        />
      </div>
    {/if}

    {#if nutritionData.recipes.length === 0 && !formOpen}
      <p class="group-empty">No recipes yet.</p>
    {:else}
      {#each nutritionData.recipes as recipe (recipe.id)}
        <div class="list-row">
          {#if formOpen}
            <div class="list-main">
              <span class="list-title">{recipe.title}</span>
              <span class="list-subtitle">
                {format(recipe.macrosPerServing.calories)} kcal per serving,
                {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
              </span>
            </div>
          {:else}
            <button
              type="button"
              class="list-main recipe-open"
              id={`open-recipe-${recipe.id}`}
              onclick={() => void openDetail(recipe)}
            >
              <span class="list-title">{recipe.title}</span>
              <span class="list-subtitle">
                {format(recipe.macrosPerServing.calories)} kcal per serving,
                {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
              </span>
            </button>
          {/if}
          <div class="list-actions">
            <button
              type="button"
              class="icon-btn muted"
              id={`edit-recipe-${recipe.id}`}
              aria-label={`Edit ${recipe.title}`}
              onclick={() => openEdit(recipe)}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-btn muted"
              aria-label={`Delete ${recipe.title}`}
              onclick={() => void handleDelete(recipe)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      {/each}
    {/if}

    {#if !formOpen && !importOpen && !editing}
      <button
        type="button"
        class="list-row add-row"
        id="new-recipe-button"
        onclick={openCreate}
      >
        <Plus size={18} aria-hidden="true" />
        <span>Add recipe</span>
      </button>
      <button
        type="button"
        class="list-row add-row"
        id="import-recipe-button"
        onclick={openImport}
      >
        <Sparkles size={18} aria-hidden="true" />
        <span>Import from text</span>
      </button>
    {/if}
  </div>

  {#if error}
    <p class="error settings-error" role="alert">{error}</p>
  {/if}
  <p class="settings-note">
    Each recipe stores its macros per serving. Logging a meal multiplies them by the
    portion.
  </p>
{/if}
