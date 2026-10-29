import { z } from "zod";
import { appConfig } from "../../../config/app.mts";

const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce
    .number()
    .int()
    .min(1)
    .max(appConfig.pagination.maxSize)
    .default(appConfig.pagination.defaultSize),
});

export const ExerciseListQuerySchema = PageQuerySchema.strict();

export const PlanListQuerySchema = PageQuerySchema.extend({
  name: z.string().trim().min(1).optional(),
}).strict();

export const SessionListQuerySchema = PageQuerySchema.extend({
  planId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from must be before to",
    path: ["from"],
  });

export {
  CreateWorkoutPlanSchema,
  CreateWorkoutSessionSchema,
  CreateWorkoutSetSchema,
} from "@gymos/shared";
