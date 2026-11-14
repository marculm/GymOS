<script lang="ts">
import { ExternalLink, Pencil } from "lucide-svelte";
import type { Recipe } from "@gymos/shared";

let {
  recipe,
  onEdit,
}: {
  recipe: Recipe;
  onEdit: () => void;
} = $props();

function format(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}
</script>

<div class="recipe-detail">
  <div class="recipe-detail-head">
    <div>
      <h1 class="recipe-title">{recipe.title}</h1>
      <p class="recipe-meta">
        {recipe.servings}
        {recipe.servings === 1 ? "serving" : "servings"}
      </p>
    </div>
    <button
      type="button"
      class="icon-btn muted"
      id="edit-recipe-detail"
      aria-label={`Edit ${recipe.title}`}
      onclick={onEdit}
    >
      <Pencil size={18} aria-hidden="true" />
    </button>
  </div>

  <div class="recipe-macros">
    <div class="recipe-macro">
      <span class="recipe-macro-label">Calories</span>
      <span class="recipe-macro-value">
        {format(recipe.macrosPerServing.calories)} <small>kcal</small>
      </span>
    </div>
    <div class="recipe-macro">
      <span class="recipe-macro-label"><i class="dot p"></i>Protein</span>
      <span class="recipe-macro-value">
        {format(recipe.macrosPerServing.proteinGrams)} <small>g</small>
      </span>
    </div>
    <div class="recipe-macro">
      <span class="recipe-macro-label"><i class="dot c"></i>Carbs</span>
      <span class="recipe-macro-value">
        {format(recipe.macrosPerServing.carbsGrams)} <small>g</small>
      </span>
    </div>
    <div class="recipe-macro">
      <span class="recipe-macro-label"><i class="dot f"></i>Fat</span>
      <span class="recipe-macro-value">
        {format(recipe.macrosPerServing.fatGrams)} <small>g</small>
      </span>
    </div>
  </div>

  <section class="recipe-section">
    <h3 class="section-header">Ingredients</h3>
    {#if recipe.ingredients.length === 0}
      <p class="settings-note">No ingredients yet.</p>
    {:else}
      <div class="group">
        {#each recipe.ingredients as ingredient, index (index)}
          <div class="list-row recipe-ingredient">
            <span class="list-main">
              <span class="list-title">{ingredient.name}</span>
            </span>
            <span class="recipe-amount">
              {format(ingredient.amount)} {ingredient.unit}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="recipe-section">
    <h3 class="section-header">Steps</h3>
    {#if recipe.instructions.length === 0}
      <p class="settings-note">No steps yet.</p>
    {:else}
      <div class="group">
        <ol class="recipe-steps">
          {#each recipe.instructions as instruction, index (index)}
            <li class="recipe-step">
              <span class="recipe-step-number">{index + 1}</span>
              <span>{instruction}</span>
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </section>

  {#if recipe.sourceUrl}
    <a
      class="recipe-source"
      href={recipe.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open source
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  {/if}
</div>
