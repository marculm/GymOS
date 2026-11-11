export const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super("The request timed out. Check your connection and try again.");
    this.name = "ApiTimeoutError";
  }
}

type RequestOptions = { timeoutMs?: number };

function detailMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((issue) => {
        if (issue && typeof issue === "object" && "message" in issue) {
          return String((issue as { message: unknown }).message);
        }
        return String(issue);
      })
      .join(", ");
  }
  return null;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiTimeoutError());
      controller.abort();
    }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(`/api${path}`, {
        ...init,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
      timeout,
    ]);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        detail?: unknown;
        title?: string;
      } | null;
      const message =
        detailMessage(body?.detail) ??
        body?.title ??
        `Request failed (${response.status})`;
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T,>(path: string, options?: RequestOptions) =>
    request<T>(path, undefined, options),
  post: <T,>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, options),
  put: <T,>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, options),
  delete: <T,>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "DELETE" }, options),
};
