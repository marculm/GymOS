import { z } from "zod";

const PageQuerySchema = z.object({
  page: z.coerce.number().int().optional(),
  size: z.coerce.number().int().optional(),
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
  CreateExerciseSchema,
  CreateWorkoutPlanSchema,
  CreateWorkoutSessionSchema,
  CreateWorkoutSetSchema,
  UpdateExerciseSchema,
  UpdateWorkoutPlanSchema,
  UpdateWorkoutRotationSchema,
  UpdateWorkoutSetSchema,
} from "@gymos/shared";
