import { Hono } from "hono";
import { register } from "prom-client";

export const prometheusRouter = new Hono();

prometheusRouter.get("/", async (c) => {
  const metrics = await register.metrics();
  return c.text(metrics, 200, { "Content-Type": register.contentType });
});
