import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const titles: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  412: "Precondition Failed",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  428: "Precondition Required",
  500: "Internal Server Error",
  501: "Not Implemented",
  503: "Service Unavailable",
};

export type ProblemDetails = {
  title: string;
  status: number;
  detail: unknown;
  instance: string;
};

export function createProblemDetails(
  c: Context,
  status: ContentfulStatusCode,
  detail: unknown
): Response {
  const body: ProblemDetails = {
    title: titles[status] ?? "Error",
    status,
    detail,
    instance: c.req.path,
  };
  const response = c.json(body, status);
  response.headers.set("Content-Type", "application/problem+json");
  return response;
}
