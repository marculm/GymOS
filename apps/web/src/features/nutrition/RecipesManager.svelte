<script lang="ts">
import { onMount, tick } from "svelte";
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-svelte";
import type { Recipe, RecipeFolder, RecipeInput } from "@gymos/shared";
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
let importTextarea = $state<HTMLTextAreaElement | null>(null);
let importRun = 0;
let listScrollTop = 0;
let currentFolderId = $state<string | null>(null);
let folderDraft = $state<{ id: string | null; parentId: string | null } | null>(
  null
);
let folderName = $state("");
let folderError = $state<string | null>(null);
let folderPending = $state(false);

const subfolders = $derived(
  nutritionData.folders.filter(
    (folder) => folder.parentId === currentFolderId
  )
);
const visibleRecipes = $derived(
  nutritionData.recipes.filter(
    (recipe) => (recipe.folderId ?? null) === currentFolderId
  )
);
const breadcrumb = $derived.by(() => {
  const path: RecipeFolder[] = [];
  let id = currentFolderId;
  while (id) {
    const folder = nutritionData.folders.find((item) => item.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
});

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
  folderDraft = null;
  formOpen = true;
}

function openEdit(recipe: Recipe) {
  editing = recipe;
  draft = null;
  error = null;
  folderDraft = null;
  formOpen = true;
}

async function openImport() {
  draft = null;
  importText = "";
  importError = null;
  folderDraft = null;
  importOpen = true;
  await tick();
  importTextarea?.focus();
}

async function cancelImport() {
  importRun += 1;
  importOpen = false;
  importText = "";
  importError = null;
  importPending = false;
  await tick();
  document.getElementById("import-recipe-button")?.focus();
}

async function extract() {
  if (importPending) return;
  const text = importText.trim();
  if (!text) {
    importError = "Paste the recipe text first.";
    return;
  }

  const run = importRun + 1;
  importRun = run;
  importPending = true;
  importError = null;
  try {
    const extracted = await nutritionData.extractRecipe({ text });
    if (run !== importRun || !importOpen) return;
    draft = extracted;
    importOpen = false;
    importText = "";
    formOpen = true;
    editing = null;
  } catch (extractError) {
    if (run !== importRun || !importOpen) return;
    importError = messageOf(extractError);
  } finally {
    if (run === importRun) importPending = false;
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

function goToFolder(id: string | null) {
  currentFolderId = id;
  folderDraft = null;
  folderError = null;
}

function openCreateFolder() {
  folderDraft = { id: null, parentId: currentFolderId };
  folderName = "";
  folderError = null;
}

function openRenameFolder(folder: RecipeFolder) {
  folderDraft = { id: folder.id, parentId: folder.parentId };
  folderName = folder.name;
  folderError = null;
}

function cancelFolderForm() {
  folderDraft = null;
  folderName = "";
  folderError = null;
}

async function saveFolder(event: SubmitEvent) {
  event.preventDefault();
  if (!folderDraft || folderPending) return;
  const name = folderName.trim();
  if (!name) {
    folderError = "Enter a folder name.";
    return;
  }

  folderPending = true;
  folderError = null;
  try {
    await nutritionData.saveFolder(folderDraft.id, name, folderDraft.parentId);
    folderDraft = null;
    folderName = "";
  } catch (saveError) {
    folderError = messageOf(saveError);
  } finally {
    folderPending = false;
  }
}

async function moveFolder(folder: RecipeFolder, direction: -1 | 1) {
  const index = subfolders.findIndex((item) => item.id === folder.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= subfolders.length) return;

  const ids = subfolders.map((item) => item.id);
  const moved = ids[index];
  const targetId = ids[target];
  if (!moved || !targetId) return;
  ids[index] = targetId;
  ids[target] = moved;
  error = null;
  try {
    await nutritionData.reorderFolders(currentFolderId, ids);
  } catch (moveError) {
    error = messageOf(moveError);
  }
}

async function handleDeleteFolder(folder: RecipeFolder) {
  if (
    !confirm(
      `Delete ${folder.name}? Its subfolders are deleted and its recipes move to the top level.`
    )
  ) {
    return;
  }
  error = null;
  try {
    await nutritionData.removeFolder(folder.id);
    if (currentFolderId === folder.id) currentFolderId = null;
  } catch (deleteError) {
    error = messageOf(deleteError);
  }
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
                bind:this={importTextarea}
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
              onclick={() => void cancelImport()}
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

    {#if !formOpen && !importOpen}
      {#if breadcrumb.length > 0}
        <div class="folder-breadcrumb">
          <button type="button" onclick={() => goToFolder(null)}>
            All recipes
          </button>
          {#each breadcrumb as folder (folder.id)}
            <span class="folder-separator" aria-hidden="true">/</span>
            <button type="button" onclick={() => goToFolder(folder.id)}>
              {folder.name}
            </button>
          {/each}
        </div>
      {/if}

      {#each subfolders as folder, index (folder.id)}
        <div class="list-row">
          <button
            type="button"
            class="list-main recipe-open"
            id={`open-folder-${folder.id}`}
            aria-label={`Open ${folder.name}`}
            onclick={() => goToFolder(folder.id)}
          >
            <span class="list-title">{folder.name}</span>
          </button>
          {#if !folderDraft}
            <div class="list-actions">
              <button
                type="button"
                class="icon-btn muted"
                aria-label={`Move ${folder.name} up`}
                disabled={index === 0}
                onclick={() => void moveFolder(folder, -1)}
              >
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="icon-btn muted"
                aria-label={`Move ${folder.name} down`}
                disabled={index === subfolders.length - 1}
                onclick={() => void moveFolder(folder, 1)}
              >
                <ArrowDown size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="icon-btn muted"
                aria-label={`Rename ${folder.name}`}
                onclick={() => openRenameFolder(folder)}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="icon-btn muted"
                aria-label={`Delete ${folder.name}`}
                onclick={() => void handleDeleteFolder(folder)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          {/if}
        </div>
      {/each}

      {#if folderDraft}
        <div class="group-form">
          <form class="stack" onsubmit={(event) => void saveFolder(event)}>
            <h3 class="card-title form-title">
              {folderDraft.id ? "Rename folder" : "New folder"}
            </h3>
            <div class="form-rows">
              <label class="field">
                <span class="label">Folder name</span>
                <input
                  class="input"
                  required
                  maxlength={100}
                  bind:value={folderName}
                />
              </label>
            </div>
            {#if folderError}
              <p class="error" role="alert">{folderError}</p>
            {/if}
            <div class="form-actions">
              <button
                class="btn btn-primary"
                type="submit"
                disabled={folderPending}
              >
                {folderDraft.id ? "Save folder" : "Create folder"}
              </button>
              <button
                class="btn btn-ghost"
                type="button"
                onclick={cancelFolderForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      {:else}
        <button
          type="button"
          class="list-row add-row"
          id="new-folder-button"
          onclick={openCreateFolder}
        >
          <FolderPlus size={18} aria-hidden="true" />
          <span>New folder</span>
        </button>
      {/if}
    {/if}

    {#if subfolders.length === 0 && visibleRecipes.length === 0 && !formOpen && !importOpen && !folderDraft}
      <p class="group-empty">
        {currentFolderId ? "This folder is empty." : "No recipes yet."}
      </p>
    {:else}
      {#each visibleRecipes as recipe (recipe.id)}
        <div class="list-row">
          {#if formOpen || importOpen}
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
          {#if !formOpen && !importOpen}
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
          {/if}
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
        onclick={() => void openImport()}
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
