import { Hono } from "hono";
import { createProblemDetails } from "../../problem-details.mts";

export const extractorModule = new Hono();

extractorModule.get("/status", (c) =>
  createProblemDetails(c, 501, "Extractor is not implemented")
);
