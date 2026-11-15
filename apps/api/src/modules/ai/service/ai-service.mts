import type { MealEstimate } from "@gymos/shared";
import {
  MEAL_ESTIMATION_SYSTEM_PROMPT,
  parseMealEstimate,
} from "../prompt/meal-estimation.mts";
import { AiInvalidResponseError, AiNotConfiguredError } from "./errors.mts";

export type JsonCompletionRequest = {
  system: string;
  user: string;
};

export type JsonCompletionClient = {
  completeJson(request: JsonCompletionRequest): Promise<string>;
};

export class AiService {
  constructor(private readonly client: JsonCompletionClient | null) {}

  async estimateMeal(description: string): Promise<MealEstimate> {
    if (!this.client) throw new AiNotConfiguredError();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const content = await this.client.completeJson({
        system: MEAL_ESTIMATION_SYSTEM_PROMPT,
        user: description,
      });
      const estimate = parseMealEstimate(content);
      if (estimate) return estimate;
    }

    throw new AiInvalidResponseError();
  }
}
