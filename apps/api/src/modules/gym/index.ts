import { Hono } from "hono";
import { CreateWorkoutPlanSchema } from "@gymos/shared";
import { zJson } from "../../lib/validation.ts";
import { createPlan, listExercises, listPlans } from "./service.ts";

export const gymModule = new Hono();

gymModule.get("/exercises", async (c) => c.json({ exercises: await listExercises() }));

gymModule.get("/plans", async (c) => c.json({ plans: await listPlans() }));

gymModule.post("/plans", zJson(CreateWorkoutPlanSchema), async (c) => {
  const plan = await createPlan(c.req.valid("json"));
  return c.json({ plan }, 201);
});
