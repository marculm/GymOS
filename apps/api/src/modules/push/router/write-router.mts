import { Hono } from "hono";
import {
  CreatePushSubscriptionSchema,
  PushSubscriptionQuerySchema,
} from "@gymos/shared";
import { container } from "../../../container.mts";
import { createProblemDetails } from "../../../problem-details.mts";
import type { AppEnv } from "../../../security/current-user.mts";

export const writeRouter = new Hono<AppEnv>();

const { pushService } = container;

writeRouter.use("*", async (c, next) => {
  if (c.req.method !== "POST" && c.req.method !== "PUT") {
    return next();
  }
  const mediaType = c.req
    .header("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return createProblemDetails(c, 415, "Content-Type must be application/json");
  }
  await next();
});

writeRouter.post("/subscriptions", async (c) => {
  const input = CreatePushSubscriptionSchema.parse(await c.req.json());
  await pushService.subscribe(c.get("user").id, input);
  return c.body(null, 204);
});

writeRouter.delete("/subscriptions", async (c) => {
  const query = PushSubscriptionQuerySchema.parse(c.req.query());
  await pushService.unsubscribe(c.get("user").id, query.endpoint);
  return c.body(null, 204);
});
