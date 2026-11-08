import type { Context, Next } from "hono";
import { createProblemDetails } from "../problem-details.mts";

export async function requireJsonContentType(c: Context, next: Next) {
  if (c.req.method !== "POST" && c.req.method !== "PUT") return next();

  const mediaType = c.req
    .header("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return createProblemDetails(c, 415, "Content-Type must be application/json");
  }
  await next();
}
