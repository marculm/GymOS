import { Hono } from "hono";
import { container } from "../../../container.mts";
import type { AppEnv } from "../../../security/current-user.mts";

export const readRouter = new Hono<AppEnv>();

const { pushService } = container;

readRouter.get("/vapid-public-key", (c) => {
  return c.json({ publicKey: pushService.getPublicKey() });
});
