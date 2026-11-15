export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI estimation is not configured. Enter the meal manually.");
    this.name = "AiNotConfiguredError";
  }
}

export class AiProviderError extends Error {
  constructor(public readonly status?: number) {
    super(
      "The estimate service is unavailable. Try again or enter the meal manually."
    );
    this.name = "AiProviderError";
  }
}

export class AiInvalidResponseError extends Error {
  constructor() {
    super(
      "The estimate could not be read. Try again or enter the meal manually."
    );
    this.name = "AiInvalidResponseError";
  }
}
