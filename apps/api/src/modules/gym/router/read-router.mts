import { Hono } from "hono";
import { container } from "../../../container.mts";
import type { AppEnv } from "../../../security/current-user.mts";
import { createPageable } from "../service/pageable.mts";
import { createPage } from "./page.mts";
import {
  ExerciseListQuerySchema,
  PlanListQuerySchema,
  SessionListQuerySchema,
} from "./validation.mts";

export const readRouter = new Hono<AppEnv>();

const { readService } = container;

readRouter.get("/exercises", async (c) => {
  const query = ExerciseListQuerySchema.parse(c.req.query());
  const pageable = createPageable(query);
  const slice = await readService.listExercises(pageable);
  return c.json(createPage(slice, pageable));
});

readRouter.get("/plans", async (c) => {
  const query = PlanListQuerySchema.parse(c.req.query());
  const pageable = createPageable(query);
  const slice = await readService.listPlans(c.get("user").id, pageable, {
    name: query.name,
  });
  return c.json(createPage(slice, pageable));
});

readRouter.get("/sessions", async (c) => {
  const query = SessionListQuerySchema.parse(c.req.query());
  const pageable = createPageable(query);
  const slice = await readService.listSessions(c.get("user").id, pageable, {
    planId: query.planId,
    from: query.from,
    to: query.to,
  });
  return c.json(createPage(slice, pageable));
});

readRouter.get("/sessions/active", async (c) => {
  const session = await readService.getActiveSession(c.get("user").id);
  return c.json(session);
});

readRouter.get("/sessions/:id", async (c) => {
  const session = await readService.getSession(
    c.get("user").id,
    c.req.param("id")
  );
  return c.json(session);
});
