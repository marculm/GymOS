export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Enter the values manually.");
    this.name = "AiNotConfiguredError";
  }
}

export class AiProviderError extends Error {
  constructor(public readonly status?: number) {
    super(
      "The AI service is unavailable. Try again or enter the values manually."
    );
    this.name = "AiProviderError";
  }

  get retryable(): boolean {
    return this.status === undefined || this.status === 429 || this.status >= 500;
  }
}

export class AiInvalidResponseError extends Error {
  constructor() {
    super(
      "The AI response could not be read. Try again or enter the values manually."
    );
    this.name = "AiInvalidResponseError";
  }
}
