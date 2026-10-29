import { Hono } from "hono";
import { prisma } from "../config/prisma-client.mts";
import { createProblemDetails } from "../problem-details.mts";

export const healthRouter = new Hono();

healthRouter.get("/liveness", (c) => c.json({ status: "up" }));

healthRouter.get("/readiness", async (c) => {
  try {
    await prisma.user.count();
    return c.json({ status: "up" });
  } catch {
    return createProblemDetails(c, 503, "Database unavailable");
  }
});
