import type { Recipe, RecipeFolder } from "@gymos/shared";

export function folderTree(folders: RecipeFolder[]): RecipeFolder[] {
  const byParent = new Map<string | null, RecipeFolder[]>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentId, siblings);
  }

  const ordered: RecipeFolder[] = [];
  const walk = (parentId: string | null) => {
    for (const folder of byParent.get(parentId) ?? []) {
      ordered.push(folder);
      walk(folder.id);
    }
  };
  walk(null);
  return ordered;
}

export function folderPath(
  folders: RecipeFolder[],
  id: string
): RecipeFolder[] {
  const path: RecipeFolder[] = [];
  let parentId: string | null = id;
  while (parentId) {
    const folder = folders.find((item) => item.id === parentId);
    if (!folder) break;
    path.unshift(folder);
    parentId = folder.parentId;
  }
  return path;
}

export function folderLabel(folders: RecipeFolder[], id: string): string {
  return folderPath(folders, id)
    .map((folder) => folder.name)
    .join(" / ");
}

export type RecipeGroup = {
  key: string;
  label: string;
  recipes: Recipe[];
};

export function groupRecipes(
  recipes: Recipe[],
  folders: RecipeFolder[]
): RecipeGroup[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const groups: RecipeGroup[] = [];
  const unfiled = recipes.filter(
    (recipe) => !recipe.folderId || !folderIds.has(recipe.folderId)
  );
  if (unfiled.length > 0) {
    groups.push({ key: "unfiled", label: "Unfiled", recipes: unfiled });
  }

  for (const folder of folderTree(folders)) {
    const items = recipes.filter((recipe) => recipe.folderId === folder.id);
    if (items.length === 0) continue;
    groups.push({
      key: folder.id,
      label: folderLabel(folders, folder.id),
      recipes: items,
    });
  }
  return groups;
}
