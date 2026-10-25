import { Hono } from "hono";
import { prisma } from "../../db/client.ts";
import { logger } from "../../lib/logger.ts";

const gymLogger = logger.child({ module: "gym" });

export const gymModule = new Hono();

gymModule.get("/exercises", async (c) => {
  gymLogger.debug("Fetching exercises list from database");
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
  });
  return c.json({ exercises });
});
