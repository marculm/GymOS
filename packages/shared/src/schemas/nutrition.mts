import { z } from "zod";

export const MacrosSchema = z.object({
  calories: z.number().nonnegative(),
  proteinGrams: z.number().nonnegative(),
  carbsGrams: z.number().nonnegative(),
  fatGrams: z.number().nonnegative(),
});

export const NutritionLogEntrySchema = z.object({
  id: z.string().uuid(),
  loggedAt: z.coerce.date(),
  name: z.string().min(1),
  macros: MacrosSchema,
});

export type Macros = z.infer<typeof MacrosSchema>;
export type NutritionLogEntry = z.infer<typeof NutritionLogEntrySchema>;
