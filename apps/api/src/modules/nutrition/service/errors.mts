export class NutritionNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NutritionNotFoundError";
  }
}
