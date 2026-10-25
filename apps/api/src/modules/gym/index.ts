import { Hono } from "hono";
import { logger } from "../../lib/logger.ts";

const gymLogger = logger.child({ module: "gym" });

export const gymModule = new Hono();

gymModule.get("/exercises", (c) => {
  gymLogger.debug("Fetching exercises list");
  return c.json({
    exercises: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Bench Press",
        muscleGroup: "chest",
        description: "Barbell Flat Bench Press",
      },
    ],
  });
});
