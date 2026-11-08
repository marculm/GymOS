import { Hono } from "hono";
import {
  CreatePushSubscriptionSchema,
  PushSubscriptionQuerySchema,
  SetRestTimerSchema,
} from "@gymos/shared";
import { container } from "../../../container.mts";
import { requireJsonContentType } from "../../../lib/require-json.mts";
import type { AppEnv } from "../../../security/current-user.mts";

export const writeRouter = new Hono<AppEnv>();

const { pushService } = container;

writeRouter.use("*", requireJsonContentType);

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

writeRouter.put("/rest-timer", async (c) => {
  const input = SetRestTimerSchema.parse(await c.req.json());
  await pushService.setRestTimer(c.get("user").id, new Date(input.endAt));
  return c.body(null, 204);
});

writeRouter.delete("/rest-timer", async (c) => {
  await pushService.cancelRestTimer(c.get("user").id);
  return c.body(null, 204);
});
