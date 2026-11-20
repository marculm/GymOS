import { describe, expect, it } from "vitest";
import {
  RecipeExtractionInputSchema,
  RecipeFolderInputSchema,
  RecipeFolderOrderSchema,
  RecipeFolderSchema,
  RecipeFolderUpdateSchema,
  RecipeInputSchema,
  RecipeSchema,
  RecipeUpdateSchema,
} from "./recipe.mts";

const folderId = "00000000-0000-4000-8000-000000000001";
const parentId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";

describe("RecipeFolderSchema", () => {
  it("trims the folder name and keeps the parent association", () => {
    expect(
      RecipeFolderSchema.parse({
        id: folderId,
        name: "  Breakfast  ",
        parentId,
        position: 2,
      })
    ).toEqual({ id: folderId, name: "Breakfast", parentId, position: 2 });
  });

  it("allows a top-level folder with no parent", () => {
    expect(
      RecipeFolderSchema.parse({
        id: folderId,
        name: "Dinner",
        parentId: null,
        position: 0,
      }).parentId
    ).toBeNull();
  });

  it("rejects a blank or too long name", () => {
    const base = { id: folderId, parentId: null, position: 0 };
    expect(() =>
      RecipeFolderSchema.parse({ ...base, name: "   " })
    ).toThrow();
    expect(() =>
      RecipeFolderSchema.parse({ ...base, name: "a".repeat(101) })
    ).toThrow();
  });

  it("rejects a non-uuid parent and a negative position", () => {
    expect(() =>
      RecipeFolderSchema.parse({ id: folderId, name: "Dinner", parentId: "x", position: 0 })
    ).toThrow();
    expect(() =>
      RecipeFolderSchema.parse({
        id: folderId,
        name: "Dinner",
        parentId: null,
        position: -1,
      })
    ).toThrow();
  });
});

describe("RecipeFolderInputSchema", () => {
  it("accepts a name with no parent", () => {
    expect(RecipeFolderInputSchema.parse({ name: "  Lunch " })).toEqual({
      name: "Lunch",
    });
  });

  it("accepts a parent folder", () => {
    expect(
      RecipeFolderInputSchema.parse({ name: "Lunch", parentId })
    ).toEqual({ name: "Lunch", parentId });
  });

  it("rejects a blank name", () => {
    expect(() => RecipeFolderInputSchema.parse({ name: " " })).toThrow();
  });
});

describe("RecipeFolderUpdateSchema", () => {
  it("requires a non-blank name", () => {
    expect(RecipeFolderUpdateSchema.parse({ name: " Meals " })).toEqual({
      name: "Meals",
    });
    expect(() => RecipeFolderUpdateSchema.parse({})).toThrow();
  });
});

describe("RecipeFolderOrderSchema", () => {
  it("accepts ordered sibling ids under a parent", () => {
    expect(
      RecipeFolderOrderSchema.parse({ parentId, ids: [otherId, folderId] })
    ).toEqual({ parentId, ids: [otherId, folderId] });
  });

  it("accepts a top-level order with a null parent", () => {
    expect(
      RecipeFolderOrderSchema.parse({ parentId: null, ids: [folderId] })
    ).toEqual({ parentId: null, ids: [folderId] });
  });

  it("rejects an empty order and non-uuid ids", () => {
    expect(() =>
      RecipeFolderOrderSchema.parse({ parentId: null, ids: [] })
    ).toThrow();
    expect(() =>
      RecipeFolderOrderSchema.parse({ parentId: null, ids: ["nope"] })
    ).toThrow();
  });
});

describe("recipe folder association", () => {
  const recipe = {
    id: folderId,
    title: "Pancakes",
    servings: 1,
    macrosPerServing: {
      calories: 410,
      proteinGrams: 12,
      carbsGrams: 60,
      fatGrams: 13,
    },
    ingredients: [],
    instructions: [],
  };

  it("accepts a recipe in a folder, at the top level, or without the field", () => {
    expect(
      RecipeSchema.parse({ ...recipe, folderId: parentId }).folderId
    ).toBe(parentId);
    expect(
      RecipeSchema.parse({ ...recipe, folderId: null }).folderId
    ).toBeNull();
    expect(RecipeSchema.parse(recipe).folderId).toBeUndefined();
  });

  it("keeps the folder association optional on recipe input", () => {
    expect(RecipeInputSchema.parse(recipe).folderId).toBeUndefined();
  });

  it("moves a recipe to a folder or back to the top level on update", () => {
    expect(RecipeUpdateSchema.parse({ folderId: parentId }).folderId).toBe(
      parentId
    );
    expect(RecipeUpdateSchema.parse({ folderId: null }).folderId).toBeNull();
    expect(() =>
      RecipeUpdateSchema.parse({ folderId: "not-a-uuid" })
    ).toThrow();
  });
});

describe("RecipeExtractionInputSchema", () => {
  it("trims pasted recipe text", () => {
    expect(
      RecipeExtractionInputSchema.parse({ text: "  Mix the batter.  " })
    ).toEqual({ text: "Mix the batter." });
  });

  it("rejects blank text", () => {
    expect(() =>
      RecipeExtractionInputSchema.parse({ text: "   " })
    ).toThrow();
  });

  it("rejects text over 8000 characters", () => {
    expect(() =>
      RecipeExtractionInputSchema.parse({ text: "a".repeat(8001) })
    ).toThrow();
  });
});
