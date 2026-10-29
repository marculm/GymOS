import { Hono } from "hono";
import { createProblemDetails } from "../../problem-details.mts";

export const nutritionModule = new Hono();

nutritionModule.get("/summary", (c) =>
  createProblemDetails(c, 501, "Nutrition is not implemented")
);
