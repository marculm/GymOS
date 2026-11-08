import { Hono } from "hono";
import { container } from "../../../container.mts";
import { createProblemDetails } from "../../../problem-details.mts";
import type { AppEnv } from "../../../security/current-user.mts";
import { createBaseUrl } from "./create-base-url.mts";
import { statuscode } from "./statuscode.mts";
import {
  CreateExerciseSchema,
  CreateWorkoutPlanSchema,
  CreateWorkoutSessionSchema,
  CreateWorkoutSetSchema,
  UpdateExerciseSchema,
  UpdateWorkoutPlanSchema,
  UpdateWorkoutRotationSchema,
  UpdateWorkoutSetSchema,
} from "./validation.mts";

export const writeRouter = new Hono<AppEnv>();

const { writeService } = container;

writeRouter.use("*", async (c, next) => {
  if (c.req.method !== "POST" && c.req.method !== "PUT") {
    return next();
  }
  if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
    return createProblemDetails(c, 415, "Content-Type must be application/json");
  }
  await next();
});

writeRouter.post("/exercises", async (c) => {
  const input = CreateExerciseSchema.parse(await c.req.json());
  const exercise = await writeService.createExercise(input);
  c.header("Location", `${createBaseUrl(c)}/${exercise.id}`);
  return c.json(exercise, statuscode.CREATED);
});

writeRouter.put("/exercises/:id", async (c) => {
  const input = UpdateExerciseSchema.parse(await c.req.json());
  const exercise = await writeService.updateExercise(
    c.req.param("id"),
    input
  );
  return c.json(exercise, statuscode.OK);
});

writeRouter.delete("/exercises/:id", async (c) => {
  const exercise = await writeService.deleteExercise(c.req.param("id"));
  return c.json(exercise, statuscode.OK);
});

writeRouter.post("/plans", async (c) => {
  const input = CreateWorkoutPlanSchema.parse(await c.req.json());
  const plan = await writeService.createPlan(c.get("user").id, input);
  c.header("Location", `${createBaseUrl(c)}/${plan.id}`);
  return c.json(plan, statuscode.CREATED);
});

writeRouter.put("/plans/:id", async (c) => {
  const input = UpdateWorkoutPlanSchema.parse(await c.req.json());
  const plan = await writeService.updatePlan(
    c.get("user").id,
    c.req.param("id"),
    input
  );
  return c.json(plan, statuscode.OK);
});

writeRouter.delete("/plans/:id", async (c) => {
  await writeService.deletePlan(c.get("user").id, c.req.param("id"));
  return c.body(null, statuscode.NO_CONTENT);
});

writeRouter.put("/rotation", async (c) => {
  const input = UpdateWorkoutRotationSchema.parse(await c.req.json());
  const rotation = await writeService.setRotation(c.get("user").id, input);
  return c.json(rotation, statuscode.OK);
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

writeRouter.put("/sessions/:id/sets/:setId", async (c) => {
  const input = UpdateWorkoutSetSchema.parse(await c.req.json());
  const set = await writeService.updateSet(
    c.get("user").id,
    c.req.param("id"),
    c.req.param("setId"),
    input
  );
  return c.json(set, statuscode.OK);
});

writeRouter.delete("/sessions/:id/sets/:setId", async (c) => {
  await writeService.deleteSet(
    c.get("user").id,
    c.req.param("id"),
    c.req.param("setId")
  );
  return c.body(null, statuscode.NO_CONTENT);
});

writeRouter.post("/sessions/:id/complete", async (c) => {
  const session = await writeService.completeSession(
    c.get("user").id,
    c.req.param("id")
  );
  return c.json(session, statuscode.OK);
});
