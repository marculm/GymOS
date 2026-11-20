import { Hono } from "hono";
import { currentUserEmail } from "../config/env.mts";
import { prisma } from "../config/prisma-client.mts";
import { createProblemDetails } from "../problem-details.mts";

export const healthRouter = new Hono();

healthRouter.get("/liveness", (c) => c.json({ status: "up" }));

healthRouter.get("/readiness", async (c) => {
  try {
    const owner = await prisma.user.findUnique({ where: { email: currentUserEmail() } });
    if (!owner) return createProblemDetails(c, 503, "Configured user not found");
    return c.json({ status: "up" });
  } catch {
    return createProblemDetails(c, 503, "Database unavailable");
  }
});
