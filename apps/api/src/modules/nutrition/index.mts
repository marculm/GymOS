import {
  MacrosSchema,
  NutritionLogInputSchema,
  NutritionLogUpdateSchema,
  NutritionRangeQuerySchema,
  RecipeInputSchema,
  RecipeUpdateSchema,
} from "@gymos/shared";
import { Hono } from "hono";
import { container } from "../../container.mts";
import { requireJsonContentType } from "../../lib/require-json.mts";
import {
  currentUserMiddleware,
  type AppEnv,
} from "../../security/current-user.mts";

export const nutritionModule = new Hono<AppEnv>();

nutritionModule.use("*", currentUserMiddleware(container.currentUserService));
nutritionModule.use("*", requireJsonContentType);

const { nutritionService } = container;

nutritionModule.get("/summary", async (c) => {
  const { from, to } = NutritionRangeQuerySchema.parse(c.req.query());
  return c.json(await nutritionService.summary(c.get("user").id, from, to));
});

nutritionModule.get("/logs", async (c) => {
  const { from, to } = NutritionRangeQuerySchema.parse(c.req.query());
  return c.json(await nutritionService.listLogs(c.get("user").id, from, to));
});

nutritionModule.post("/logs", async (c) => {
  const input = NutritionLogInputSchema.parse(await c.req.json());
  const entry = await nutritionService.createLog(c.get("user").id, input);
  return c.json(entry, 201);
});

nutritionModule.patch("/logs/:id", async (c) => {
  const input = NutritionLogUpdateSchema.parse(await c.req.json());
  return c.json(
    await nutritionService.updateLog(c.get("user").id, c.req.param("id"), input)
  );
});

nutritionModule.delete("/logs/:id", async (c) => {
  await nutritionService.deleteLog(c.get("user").id, c.req.param("id"));
  return c.body(null, 204);
});

nutritionModule.get("/targets", async (c) =>
  c.json(await nutritionService.getTargets(c.get("user").id))
);

nutritionModule.put("/targets", async (c) => {
  const input = MacrosSchema.parse(await c.req.json());
  return c.json(await nutritionService.setTargets(c.get("user").id, input));
});

nutritionModule.get("/recipes", async (c) =>
  c.json(await nutritionService.listRecipes(c.get("user").id))
);

nutritionModule.post("/recipes", async (c) => {
  const input = RecipeInputSchema.parse(await c.req.json());
  return c.json(await nutritionService.createRecipe(c.get("user").id, input), 201);
});

nutritionModule.patch("/recipes/:id", async (c) => {
  const input = RecipeUpdateSchema.parse(await c.req.json());
  return c.json(
    await nutritionService.updateRecipe(
      c.get("user").id,
      c.req.param("id"),
      input
    )
  );
});

nutritionModule.delete("/recipes/:id", async (c) => {
  await nutritionService.deleteRecipe(c.get("user").id, c.req.param("id"));
  return c.body(null, 204);
});
