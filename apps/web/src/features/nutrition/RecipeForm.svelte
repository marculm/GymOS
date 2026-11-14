<script lang="ts">
import type { Recipe, RecipeInput } from "@gymos/shared";

type IngredientRow = { name: string; amount: string; unit: string };

let {
  recipe = null,
  onSubmit,
  onCancel,
}: {
  recipe?: Recipe | null;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel: () => void;
} = $props();

// svelte-ignore state_referenced_locally
let title = $state(recipe?.title ?? "");
// svelte-ignore state_referenced_locally
let servings = $state(String(recipe?.servings ?? 1));
// svelte-ignore state_referenced_locally
let calories = $state(String(recipe?.macrosPerServing.calories ?? ""));
// svelte-ignore state_referenced_locally
let proteinGrams = $state(String(recipe?.macrosPerServing.proteinGrams ?? ""));
// svelte-ignore state_referenced_locally
let carbsGrams = $state(String(recipe?.macrosPerServing.carbsGrams ?? ""));
// svelte-ignore state_referenced_locally
let fatGrams = $state(String(recipe?.macrosPerServing.fatGrams ?? ""));
// svelte-ignore state_referenced_locally
let sourceUrl = $state(recipe?.sourceUrl ?? "");
// svelte-ignore state_referenced_locally
let ingredients = $state<IngredientRow[]>(
  recipe
    ? recipe.ingredients.map((item) => ({
        name: item.name,
        amount: String(item.amount),
        unit: item.unit,
      }))
    : [{ name: "", amount: "", unit: "" }]
);
// svelte-ignore state_referenced_locally
let instructions = $state(recipe?.instructions.join("\n") ?? "");

let pending = $state(false);
let error = $state<string | null>(null);

function addIngredient() {
  ingredients = [...ingredients, { name: "", amount: "", unit: "" }];
}

function removeIngredient(index: number) {
  ingredients = ingredients.filter((_, rowIndex) => rowIndex !== index);
}

function parseInput(): RecipeInput | null {
  const name = title.trim();
  const servingCount = Number(servings);
  const macroValues = {
    calories: Number(calories),
    proteinGrams: Number(proteinGrams),
    carbsGrams: Number(carbsGrams),
    fatGrams: Number(fatGrams),
  };
  if (!name) return null;
  if (!Number.isInteger(servingCount) || servingCount <= 0) return null;
  if (
    Object.values(macroValues).some(
      (value) => !Number.isFinite(value) || value < 0
    )
  ) {
    return null;
  }

  const rows = ingredients.map((row) => ({
    name: row.name.trim(),
    amount: Number(row.amount),
    unit: row.unit.trim(),
  }));
  const filled = rows.filter(
    (row) => row.name.length > 0 || row.unit.length > 0 || row.amount > 0
  );
  if (
    filled.some(
      (row) =>
        !row.name ||
        !row.unit ||
        !Number.isFinite(row.amount) ||
        row.amount <= 0
    )
  ) {
    return null;
  }

  const url = sourceUrl.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return null;
    }
  }

  return {
    title: name,
    ...(url ? { sourceUrl: url } : {}),
    servings: servingCount,
    macrosPerServing: macroValues,
    ingredients: filled,
    instructions: instructions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

async function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (pending) return;
  const input = parseInput();
  if (!input) {
    error =
      "Enter a name, servings, macros of zero or more, and complete ingredient rows.";
    return;
  }

  pending = true;
  error = null;
  try {
    await onSubmit(input);
  } catch (submitError) {
    error =
      submitError instanceof Error
        ? submitError.message
        : "Could not save the recipe";
  } finally {
    pending = false;
  }
}
</script>

<form class="stack" onsubmit={handleSubmit}>
  <h3 class="card-title form-title">
    {recipe ? "Edit recipe" : "New recipe"}
  </h3>

  <div class="form-rows">
    <label class="field">
      <span class="label">Name</span>
      <input class="input" required maxlength={200} placeholder="Recipe name" bind:value={title} />
    </label>
    <label class="field">
      <span class="label">Servings</span>
      <input class="input" type="number" min="1" step="1" required bind:value={servings} />
    </label>
    <label class="field">
      <span class="label">Calories per serving</span>
      <input class="input" type="number" min="0" step="any" required bind:value={calories} />
    </label>
    <label class="field">
      <span class="label">Protein per serving</span>
      <input class="input" type="number" min="0" step="any" required bind:value={proteinGrams} />
    </label>
    <label class="field">
      <span class="label">Carbs per serving</span>
      <input class="input" type="number" min="0" step="any" required bind:value={carbsGrams} />
    </label>
    <label class="field">
      <span class="label">Fat per serving</span>
      <input class="input" type="number" min="0" step="any" required bind:value={fatGrams} />
    </label>
    <label class="field">
      <span class="label">Source URL</span>
      <input class="input" type="url" placeholder="Optional" bind:value={sourceUrl} />
    </label>
  </div>

  <div class="recipe-ingredients">
    {#each ingredients as row, index (index)}
      <div class="recipe-ingredient">
        <div class="form-rows">
          <label class="field">
            <span class="label">Ingredient</span>
            <input class="input" placeholder="Chicken breast" bind:value={row.name} />
          </label>
          <label class="field">
            <span class="label">Amount</span>
            <input class="input" type="number" min="0" step="any" placeholder="300" bind:value={row.amount} />
          </label>
          <label class="field">
            <span class="label">Unit</span>
            <input class="input" placeholder="g" bind:value={row.unit} />
          </label>
        </div>
        <button
          type="button"
          class="remove-ingredient"
          disabled={ingredients.length === 1}
          onclick={() => removeIngredient(index)}
        >
          Remove
        </button>
      </div>
    {/each}
  </div>
  <div class="form-actions">
    <button type="button" class="btn btn-ghost" onclick={addIngredient}>
      Add ingredient
    </button>
  </div>

  <div class="form-rows">
    <label class="field field-block">
      <span class="label">Instructions</span>
      <textarea
        class="input"
        rows="4"
        placeholder="One step per line"
        bind:value={instructions}
      ></textarea>
    </label>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="form-actions">
    <button class="btn btn-primary" type="submit" disabled={pending}>
      Save recipe
    </button>
    <button class="btn btn-ghost" type="button" disabled={pending} onclick={onCancel}>
      Cancel
    </button>
  </div>
</form>
