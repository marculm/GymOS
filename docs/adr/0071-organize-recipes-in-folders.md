# Organize Recipes in Folders

## Status

Accepted

## Context

The recipe library listed every saved recipe as one flat, title-ordered list, and the
saved-recipe picker in the nutrition logging flow did the same. The `Recipe` model had no
grouping field, so a growing collection could not be organized. Recipes are owner-scoped
like every other nutrition record and the single-user ownership model stays unchanged.

## Decision

- Add a `RecipeFolder` model with a nullable self-referencing `parentId`. A folder has one
  parent, so the folders form a tree; a folder with `parentId = null` lives at the top
  level. Folders are owner-scoped through `userId` like recipes.
- Add a nullable `Recipe.folderId`. A recipe belongs to at most one folder; `folderId =
  null` means the recipe lives at the top level.
- Order folders manually: each folder stores an integer `position` among its siblings.
  `PUT /api/nutrition/recipe-folders/order` accepts the ordered sibling ids for one
  parent and rewrites their positions in a transaction. Recipes keep their existing title
  order within a folder.
- `GET /api/nutrition/recipe-folders` returns the owner's folders as a flat list with
  `parentId` and `position`; the web app builds the tree. `POST` creates a folder at the
  end of its parent's sibling list, `PATCH /:id` renames it, and `DELETE /:id` removes it.
- Deleting a folder relies on database foreign keys: the `parentId` self-relation
  cascades to subfolders, and `Recipe.folderId` uses `ON DELETE SET NULL`. Deleting a
  folder therefore removes its subtree and moves every recipe in that subtree to the top
  level.
- Creating or updating a recipe with a `folderId` checks that the folder belongs to the
  current user; a foreign or missing folder returns `404`. The existing recipe create,
  edit, delete, detail, and portion-logging behavior is unchanged.
- The recipe library browses one folder at a time, showing its subfolders and its direct
  recipes, with a breadcrumb back to the top level. Folder creation, rename, delete, and
  up/down reorder are inline actions. The recipe form has a folder selector defaulted to
  the folder being browsed.
- The saved-recipe picker in the nutrition logging flow groups recipes under their folder
  path; top-level recipes appear under an "Unfiled" heading.

## Consequences

- Folder order and recipe assignments persist across reloads.
- The folder tree is a single-parent hierarchy; a recipe cannot be in several folders and
  folders cannot be shared between users (multi-user support is ADR-0009 work).
- Deleting a folder is destructive for its subfolders and permanent; recipes survive at
  the top level, so no recipe data is lost.
- The AI import and estimation flows do not assign folders; a created or imported recipe
  starts at the top level unless the user picks a folder in the form.
- This follows the existing module layering: shared Zod schemas, Hono routes, a service,
  and a Prisma repository (ADR-0003, ADR-0005, ADR-0013).
