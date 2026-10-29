import { validator } from "hono/validator";
import type { z } from "zod";

export function zJson<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
    }
    return parsed.data;
  });
}

export function zQuery<T extends z.ZodType>(schema: T) {
  return validator("query", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid query parameters", issues: parsed.error.issues }, 400);
    }
    return parsed.data;
  });
}
