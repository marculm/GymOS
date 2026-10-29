import { Hono } from "hono";
import { getLogger } from "../../logger/logger.mts";

const nutritionLogger = getLogger("nutrition");

export const nutritionModule = new Hono();

nutritionModule.get("/summary", (c) => {
  nutritionLogger.debug("Fetching daily nutrition summary");
  return c.json({
    date: new Date().toISOString(),
    calories: 2200,
    protein: 160,
    carbs: 220,
    fat: 65,
  });
});
