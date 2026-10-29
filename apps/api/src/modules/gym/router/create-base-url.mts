import type { Context } from "hono";

export function createBaseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.origin}${url.pathname}`;
}
