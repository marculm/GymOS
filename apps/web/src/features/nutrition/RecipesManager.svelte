<script lang="ts">
import { onMount, tick } from "svelte";
import { Pencil, Plus, Trash2 } from "lucide-svelte";
import type { Recipe, RecipeInput } from "@gymos/shared";
import RecipeForm from "./RecipeForm.svelte";
import { nutritionData } from "./nutrition-data.svelte.ts";

let error = $state<string | null>(null);
let formOpen = $state(false);
let editing = $state<Recipe | null>(null);

onMount(() => {
  void load();
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
  error = null;
  formOpen = true;
}

function openEdit(recipe: Recipe) {
  editing = recipe;
  error = null;
  formOpen = true;
}

async function close(focusId: string) {
  formOpen = false;
  editing = null;
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

<div class="group">
  {#if formOpen}
    <div class="group-form">
      <RecipeForm recipe={editing} onSubmit={handleSubmit} onCancel={cancel} />
    </div>
  {/if}

  {#if nutritionData.recipes.length === 0 && !formOpen}
    <p class="group-empty">No recipes yet.</p>
  {:else}
    {#each nutritionData.recipes as recipe (recipe.id)}
      <div class="list-row">
        <div class="list-main">
          <h3 class="list-title">{recipe.title}</h3>
          <span class="list-subtitle">
            {format(recipe.macrosPerServing.calories)} kcal per serving,
            {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
          </span>
        </div>
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

  {#if !formOpen && !editing}
    <button
      type="button"
      class="list-row add-row"
      id="new-recipe-button"
      onclick={openCreate}
    >
      <Plus size={18} aria-hidden="true" />
      <span>Add recipe</span>
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
