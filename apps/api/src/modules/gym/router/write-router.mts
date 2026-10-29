import { Hono } from "hono";
import { container } from "../../../container.mts";
import type { AppEnv } from "../../../security/current-user.mts";
import { createBaseUrl } from "./create-base-url.mts";
import { statuscode } from "./statuscode.mts";
import {
  CreateWorkoutPlanSchema,
  CreateWorkoutSessionSchema,
  CreateWorkoutSetSchema,
} from "./validation.mts";

export const writeRouter = new Hono<AppEnv>();

const { writeService } = container;

writeRouter.post("/plans", async (c) => {
  const input = CreateWorkoutPlanSchema.parse(await c.req.json());
  const plan = await writeService.createPlan(c.get("user").id, input);
  c.header("Location", `${createBaseUrl(c)}/${plan.id}`);
  return c.json(plan, statuscode.CREATED);
});

writeRouter.post("/sessions", async (c) => {
  const input = CreateWorkoutSessionSchema.parse(await c.req.json());
  const session = await writeService.startSession(c.get("user").id, input);
  c.header("Location", `${createBaseUrl(c)}/${session.id}`);
  return c.json(session, statuscode.CREATED);
});

writeRouter.post("/sessions/:id/sets", async (c) => {
  const input = CreateWorkoutSetSchema.parse(await c.req.json());
  const set = await writeService.logSet(
    c.get("user").id,
    c.req.param("id"),
    input
  );
  return c.json(set, statuscode.CREATED);
});

writeRouter.post("/sessions/:id/complete", async (c) => {
  const session = await writeService.completeSession(
    c.get("user").id,
    c.req.param("id")
  );
  return c.json(session, statuscode.OK);
});
