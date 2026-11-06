import { z } from "zod";
import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from "../limits.mts";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
] as const;

export const MuscleGroupSchema = z.enum(MUSCLE_GROUPS);

export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  muscleGroup: MuscleGroupSchema,
  description: z.string().nullable(),
  defaultSets: z.number().int().positive(),
  defaultReps: z.number().int().positive(),
  defaultWeightKg: z.number().nonnegative().nullable(),
});

export const CreateExerciseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  muscleGroup: MuscleGroupSchema,
  description: z.string().max(500).nullable().optional(),
  defaultSets: z.number().int().min(1).max(20).optional(),
  defaultReps: z.number().int().min(1).max(100).optional(),
  defaultWeightKg: z.number().nonnegative().nullable().optional(),
});

export const UpdateExerciseSchema = CreateExerciseSchema;

export const DUPLICATE_EXERCISE_MESSAGE =
  "Each exercise can only be added once";

export const DUPLICATE_ROTATION_PLAN_MESSAGE =
  "Each plan can only appear once in the rotation";

export const CreateWorkoutPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50)
    .refine(
      (exercises) =>
        new Set(exercises.map((exercise) => exercise.exerciseId)).size ===
        exercises.length,
      DUPLICATE_EXERCISE_MESSAGE
    ),
});

export const UpdateWorkoutPlanSchema = CreateWorkoutPlanSchema;

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

export const UpdateWorkoutRotationSchema = z.object({
  planIds: z
    .array(z.string().uuid())
    .max(50)
    .refine(
      (planIds) => new Set(planIds).size === planIds.length,
      DUPLICATE_ROTATION_PLAN_MESSAGE
    ),
});

export const WorkoutRotationSchema = z.object({
  plans: z.array(WorkoutPlanSchema),
  nextPlanId: z.string().uuid().nullable(),
});

export const CreateWorkoutSessionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  planId: z.string().uuid().optional(),
});

export const CreateWorkoutSetSchema = z.object({
  exerciseId: z.string().uuid(),
  reps: z.number().int().positive().max(MAX_SET_REPS),
  weightKg: z.number().nonnegative().max(MAX_SET_WEIGHT_KG),
});

export const LoggedSetSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
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

export const WeightSuggestionsSchema = z.record(
  z.string(),
  z.number().nonnegative()
);

export const WorkoutSessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  planId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  totalSets: z.number().int().nonnegative(),
});

export const PersonalRecordSchema = z.object({
  exerciseId: z.string().uuid(),
  exerciseName: z.string().min(1),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().positive(),
  achievedAt: z.iso.datetime(),
});

export const VolumePointSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1),
  startedAt: z.iso.datetime(),
  totalVolumeKg: z.number().nonnegative(),
});

export const WorkoutProgressSchema = z.object({
  personalRecords: z.array(PersonalRecordSchema),
  volume: z.array(VolumePointSchema),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof UpdateExerciseSchema>;
export type CreateWorkoutPlanInput = z.infer<typeof CreateWorkoutPlanSchema>;
export type UpdateWorkoutPlanInput = z.infer<typeof UpdateWorkoutPlanSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type WorkoutPlanExercise = z.infer<typeof WorkoutPlanExerciseSchema>;
export type UpdateWorkoutRotationInput = z.infer<typeof UpdateWorkoutRotationSchema>;
export type WorkoutRotation = z.infer<typeof WorkoutRotationSchema>;
export type CreateWorkoutSessionInput = z.infer<typeof CreateWorkoutSessionSchema>;
export type CreateWorkoutSetInput = z.infer<typeof CreateWorkoutSetSchema>;
export type LoggedSet = z.infer<typeof LoggedSetSchema>;
export type WorkoutSessionDetail = z.infer<typeof WorkoutSessionDetailSchema>;
export type WorkoutSessionSummary = z.infer<typeof WorkoutSessionSummarySchema>;
export type WeightSuggestions = z.infer<typeof WeightSuggestionsSchema>;
export type PersonalRecord = z.infer<typeof PersonalRecordSchema>;
export type VolumePoint = z.infer<typeof VolumePointSchema>;
export type WorkoutProgress = z.infer<typeof WorkoutProgressSchema>;
