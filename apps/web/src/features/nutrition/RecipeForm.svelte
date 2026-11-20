<script lang="ts">
import { tick } from "svelte";
import type { Recipe, RecipeFolder, RecipeInput } from "@gymos/shared";
import { folderLabel, folderTree } from "./folders.mts";

type IngredientRow = { name: string; amount: string; unit: string };

let {
  recipe = null,
  draft = null,
  folders = [],
  defaultFolderId = null,
  onSubmit,
  onCancel,
}: {
  recipe?: Recipe | null;
  draft?: RecipeInput | null;
  folders?: RecipeFolder[];
  defaultFolderId?: string | null;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel: () => void;
} = $props();

// svelte-ignore state_referenced_locally
const initial = recipe ?? draft;

// svelte-ignore state_referenced_locally
let title = $state(initial?.title ?? "");
// svelte-ignore state_referenced_locally
let servings = $state(String(initial?.servings ?? 1));
// svelte-ignore state_referenced_locally
let calories = $state(String(initial?.macrosPerServing.calories ?? ""));
// svelte-ignore state_referenced_locally
let proteinGrams = $state(String(initial?.macrosPerServing.proteinGrams ?? ""));
// svelte-ignore state_referenced_locally
let carbsGrams = $state(String(initial?.macrosPerServing.carbsGrams ?? ""));
// svelte-ignore state_referenced_locally
let fatGrams = $state(String(initial?.macrosPerServing.fatGrams ?? ""));
// svelte-ignore state_referenced_locally
let sourceUrl = $state(initial?.sourceUrl ?? "");
// svelte-ignore state_referenced_locally
let ingredients = $state<IngredientRow[]>(
  initial
    ? initial.ingredients.map((item) => ({
        name: item.name,
        amount: String(item.amount),
        unit: item.unit,
      }))
    : [{ name: "", amount: "", unit: "" }]
);
// svelte-ignore state_referenced_locally
let instructions = $state(initial?.instructions.join("\n") ?? "");
// svelte-ignore state_referenced_locally
let folderId = $state(
  initial ? (initial.folderId ?? "") : (defaultFolderId ?? "")
);

let pending = $state(false);
let error = $state<string | null>(null);
let ingredientList = $state<HTMLElement | null>(null);

async function addIngredient() {
  ingredients = [...ingredients, { name: "", amount: "", unit: "" }];
  await tick();
  const inputs = ingredientList?.querySelectorAll<HTMLInputElement>(
    'input[placeholder="Chicken breast"]'
  );
  const input = inputs?.[inputs.length - 1];
  if (!input) return;
  input.scrollIntoView?.({ block: "center", behavior: "smooth" });
  input.focus({ preventScroll: true });
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
    ...(folderId ? { folderId } : recipe ? { folderId: null } : {}),
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
    <label class="field">
      <span class="label">Folder</span>
      <select
        class="input"
        value={folderId}
        onchange={(event) => (folderId = event.currentTarget.value)}
      >
        <option value="">Top level</option>
        {#each folderTree(folders) as folder (folder.id)}
          <option value={folder.id}>
            {folderLabel(folders, folder.id)}
          </option>
        {/each}
      </select>
    </label>
  </div>

  <div class="recipe-ingredients" bind:this={ingredientList}>
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
