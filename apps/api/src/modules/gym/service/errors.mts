export class NotFoundError extends Error {}

export class ActiveSessionExistsError extends Error {}

export class SessionCompletedError extends Error {}

export class DuplicateSetError extends Error {}

export class DuplicatePlanNameError extends Error {}

export class DuplicateExerciseNameError extends Error {}

export class ConcurrentUpdateError extends Error {}

export class UnknownExerciseError extends Error {}

export class UnknownPlanError extends Error {}

export class InvalidMuscleGroupError extends Error {
  constructor(exerciseId: string, muscleGroup: string) {
    super(`Exercise ${exerciseId} has invalid muscle group "${muscleGroup}"`);
  }
}
