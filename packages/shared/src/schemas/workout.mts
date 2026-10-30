import { z } from "zod";

export const MAX_SET_REPS = 1000;
export const MAX_SET_WEIGHT_KG = 1000;

export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  muscleGroup: z.enum(["chest", "back", "legs", "shoulders", "arms", "core"]),
  description: z.string().nullable(),
});

export const CreateWorkoutPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        targetSets: z.number().int().min(1).max(20),
        targetReps: z.number().int().min(1).max(100),
        targetWeightKg: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50),
});

export const WorkoutPlanExerciseSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
  targetWeightKg: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
  exercise: ExerciseSchema,
});

export const WorkoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  exercises: z.array(WorkoutPlanExerciseSchema),
});

export const CreateWorkoutSessionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  planId: z.string().uuid().optional(),
});

export const CreateWorkoutSetSchema = z.object({
  exerciseId: z.string().uuid(),
  reps: z.number().int().positive().max(MAX_SET_REPS),
  weightKg: z.number().nonnegative().max(MAX_SET_WEIGHT_KG),
  rpe: z.number().min(1).max(10).optional(),
});

export const LoggedSetSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).nullable(),
  createdAt: z.iso.datetime(),
});

export const WorkoutSessionDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  planId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  sets: z.array(LoggedSetSchema),
});

export const WorkoutSessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  planId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  totalSets: z.number().int().nonnegative(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type CreateWorkoutPlanInput = z.infer<typeof CreateWorkoutPlanSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type WorkoutPlanExercise = z.infer<typeof WorkoutPlanExerciseSchema>;
export type CreateWorkoutSessionInput = z.infer<typeof CreateWorkoutSessionSchema>;
export type CreateWorkoutSetInput = z.infer<typeof CreateWorkoutSetSchema>;
export type LoggedSet = z.infer<typeof LoggedSetSchema>;
export type WorkoutSessionDetail = z.infer<typeof WorkoutSessionDetailSchema>;
export type WorkoutSessionSummary = z.infer<typeof WorkoutSessionSummarySchema>;
