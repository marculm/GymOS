import { z } from "zod";

export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  muscleGroup: z.enum(["chest", "back", "legs", "shoulders", "arms", "core"]),
  description: z.string().optional(),
});

export const WorkoutSetSchema = z.object({
  setNumber: z.number().int().positive(),
  reps: z.number().int().nonnegative(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).optional(),
});

export const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      sets: z.array(WorkoutSetSchema),
    })
  ),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
