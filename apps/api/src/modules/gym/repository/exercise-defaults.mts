import { MAX_SET_WEIGHT_KG } from "@gymos/shared/limits";

export type ExerciseDefaults = {
  defaultWeightKg: number;
  defaultReps: number;
};

type SessionSets = {
  sets: Array<{ exerciseId: string; weightKg: number; reps: number }>;
};

const SESSIONS_TO_USE = 2;
const WEIGHT_STEP_KG = 0.5;
const REP_WEIGHT_WINDOW_KG = 2.5;

function deriveDefaults(
  sets: Array<{ weightKg: number; reps: number }>
): ExerciseDefaults {
  const averageWeight =
    sets.reduce((sum, set) => sum + set.weightKg, 0) / sets.length;
  const defaultWeightKg = Math.min(
    Math.round(averageWeight / WEIGHT_STEP_KG) * WEIGHT_STEP_KG,
    MAX_SET_WEIGHT_KG
  );

  const nearTarget = sets.filter(
    (set) => Math.abs(set.weightKg - defaultWeightKg) <= REP_WEIGHT_WINDOW_KG
  );
  const repsSource = nearTarget.length > 0 ? nearTarget : sets;
  const averageReps =
    repsSource.reduce((sum, set) => sum + set.reps, 0) / repsSource.length;

  return { defaultWeightKg, defaultReps: Math.round(averageReps) };
}

export function deriveDefaultsByExercise(
  sessions: readonly SessionSets[]
): Map<string, ExerciseDefaults> {
  const setsByExercise = new Map<
    string,
    Array<{ weightKg: number; reps: number }>
  >();
  const sessionCounts = new Map<string, number>();

  for (const session of sessions) {
    const current = new Map<
      string,
      Array<{ weightKg: number; reps: number }>
    >();
    for (const set of session.sets) {
      const sets = current.get(set.exerciseId) ?? [];
      sets.push({ weightKg: set.weightKg, reps: set.reps });
      current.set(set.exerciseId, sets);
    }

    for (const [exerciseId, sets] of current) {
      const count = sessionCounts.get(exerciseId) ?? 0;
      if (count >= SESSIONS_TO_USE) continue;
      sessionCounts.set(exerciseId, count + 1);
      setsByExercise.set(exerciseId, [
        ...(setsByExercise.get(exerciseId) ?? []),
        ...sets,
      ]);
    }
  }

  const defaults = new Map<string, ExerciseDefaults>();
  for (const [exerciseId, sets] of setsByExercise) {
    defaults.set(exerciseId, deriveDefaults(sets));
  }
  return defaults;
}
