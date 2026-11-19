import type { MealEstimate, RecipeInput } from "@gymos/shared";
import {
  MEAL_ESTIMATION_SYSTEM_PROMPT,
  parseMealEstimate,
} from "../prompt/meal-estimation.mts";
import {
  parseRecipeExtraction,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
} from "../prompt/recipe-extraction.mts";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiProviderError,
} from "./errors.mts";

const RECIPE_MAX_OUTPUT_TOKENS = 2048;

export type JsonCompletionRequest = {
  system: string;
  user: string;
  maxTokens?: number;
};

export type JsonCompletionClient = {
  completeJson(request: JsonCompletionRequest): Promise<string>;
};

export class AiService {
  constructor(private readonly client: JsonCompletionClient | null) {}

  async estimateMeal(description: string): Promise<MealEstimate> {
    if (!this.client) throw new AiNotConfiguredError();

    return this.request(
      this.client,
      { system: MEAL_ESTIMATION_SYSTEM_PROMPT, user: description },
      parseMealEstimate
    );
  }

  async extractRecipe(text: string): Promise<RecipeInput> {
    if (!this.client) throw new AiNotConfiguredError();

    return this.request(
      this.client,
      {
        system: RECIPE_EXTRACTION_SYSTEM_PROMPT,
        user: text,
        maxTokens: RECIPE_MAX_OUTPUT_TOKENS,
      },
      parseRecipeExtraction
    );
  }

  private async request<T>(
    client: JsonCompletionClient,
    request: JsonCompletionRequest,
    parse: (content: string) => T | null
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let content: string;
      try {
        content = await client.completeJson(request);
      } catch (error) {
        if (
          attempt === 0 &&
          error instanceof AiProviderError &&
          error.retryable
        ) {
          continue;
        }
        throw error;
      }

      const value = parse(content);
      if (value) return value;
    }

    throw new AiInvalidResponseError();
  }
}
