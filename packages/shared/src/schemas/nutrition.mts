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

export const NutritionLogInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  loggedAt: z.coerce.date().optional(),
  macros: MacrosSchema,
});

export const NutritionLogUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  loggedAt: z.coerce.date().optional(),
  macros: MacrosSchema.optional(),
});

export const MacroDeltaSchema = z.object({
  calories: z.number(),
  proteinGrams: z.number(),
  carbsGrams: z.number(),
  fatGrams: z.number(),
});

export const NutritionSummarySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  totals: MacrosSchema,
  targets: MacrosSchema.nullable(),
  remaining: MacroDeltaSchema.nullable(),
});

export const NutritionRangeQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .strict()
  .refine((query) => query.from <= query.to, {
    message: "from must be before to",
    path: ["from"],
  });

export type Macros = z.infer<typeof MacrosSchema>;
export type NutritionLogEntry = z.infer<typeof NutritionLogEntrySchema>;
export type NutritionLogInput = z.infer<typeof NutritionLogInputSchema>;
export type NutritionLogUpdate = z.infer<typeof NutritionLogUpdateSchema>;
export type MacroDelta = z.infer<typeof MacroDeltaSchema>;
export type NutritionSummary = z.infer<typeof NutritionSummarySchema>;
