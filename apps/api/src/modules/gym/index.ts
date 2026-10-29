import { Hono } from "hono";
import {
  CreateWorkoutPlanSchema,
  CreateWorkoutSessionSchema,
  CreateWorkoutSetSchema,
} from "@gymos/shared";
import { z } from "zod";
import { zJson, zQuery } from "../../lib/validation.ts";
import {
  completeSession,
  createPlan,
  getActiveSession,
  getSession,
  listExercises,
  listPlans,
  listSessions,
  logSet,
  startSession,
} from "./service.ts";

const ListSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const gymModule = new Hono();

gymModule.get("/exercises", async (c) => c.json({ exercises: await listExercises() }));

gymModule.get("/plans", async (c) => c.json({ plans: await listPlans() }));

gymModule.post("/plans", zJson(CreateWorkoutPlanSchema), async (c) => {
  const plan = await createPlan(c.req.valid("json"));
  return c.json({ plan }, 201);
});

gymModule.post("/sessions", zJson(CreateWorkoutSessionSchema), async (c) => {
  const session = await startSession(c.req.valid("json"));
  return c.json({ session }, 201);
});

gymModule.get("/sessions/active", async (c) =>
  c.json({ session: await getActiveSession() })
);

gymModule.get("/sessions", zQuery(ListSessionsQuerySchema), async (c) => {
  const { limit } = c.req.valid("query");
  return c.json({ sessions: await listSessions(limit) });
});

gymModule.get("/sessions/:id", async (c) =>
  c.json({ session: await getSession(c.req.param("id")) })
);

gymModule.post("/sessions/:id/sets", zJson(CreateWorkoutSetSchema), async (c) => {
  const set = await logSet(c.req.param("id"), c.req.valid("json"));
  return c.json({ set }, 201);
});

gymModule.post("/sessions/:id/complete", async (c) =>
  c.json({ session: await completeSession(c.req.param("id")) })
);
