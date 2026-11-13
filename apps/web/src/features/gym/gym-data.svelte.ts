import type {
  CreateExerciseInput,
  CreateWorkoutPlanInput,
  Exercise,
  WorkoutPlan,
  WorkoutRotation,
} from "@gymos/shared";
import {
  createExercise,
  createPlan,
  deleteExercise,
  deletePlan,
  getRotation,
  listAllExercises,
  listAllPlans,
  setRotation,
  updateExercise,
  updatePlan,
} from "../../api/gym.mts";

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong";
}

function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
}

function withExercise(plan: WorkoutPlan, updated: Exercise): WorkoutPlan {
  let changed = false;
  const exercises = plan.exercises.map((entry) => {
    if (entry.exercise.id !== updated.id) return entry;
    changed = true;
    return {
      ...entry,
      exercise: updated,
      targetSets: updated.defaultSets,
      targetReps: updated.defaultReps,
      targetWeightKg: updated.defaultWeightKg,
    };
  });
  return changed ? { ...plan, exercises } : plan;
}

class GymData {
  exercises = $state<Exercise[]>([]);
  plans = $state<WorkoutPlan[]>([]);
  rotation = $state<WorkoutRotation>({ plans: [], nextPlanId: null });
  loading = $state(true);
  error = $state<string | null>(null);

  private loaded = false;
  private inFlight: Promise<void> | null = null;

  get nextPlan(): WorkoutPlan | null {
    const planId = this.rotation.nextPlanId;
    if (planId === null) return null;
    return (
      this.plans.find((plan) => plan.id === planId) ??
      this.rotation.plans.find((plan) => plan.id === planId) ??
      null
    );
  }

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchAll();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchAll(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const [exerciseList, planList, rotationState] = await Promise.all([
        listAllExercises(),
        listAllPlans(),
        getRotation(),
      ]);
      this.exercises = exerciseList;
      this.plans = planList;
      this.rotation = rotationState;
      this.loaded = true;
    } catch (loadError) {
      this.error = messageOf(loadError);
    } finally {
      this.loading = false;
    }
  }

  async reload(): Promise<void> {
    await this.load(true);
  }

  async createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
    const created = await createPlan(input);
    this.plans = [created, ...this.plans];
    return created;
  }

  async updatePlan(
    planId: string,
    input: CreateWorkoutPlanInput
  ): Promise<WorkoutPlan> {
    const updated = await updatePlan(planId, input);
    this.plans = this.plans.map((plan) =>
      plan.id === updated.id ? updated : plan
    );
    this.rotation = {
      ...this.rotation,
      plans: this.rotation.plans.map((plan) =>
        plan.id === updated.id ? updated : plan
      ),
    };
    return updated;
  }

  async deletePlan(planId: string): Promise<void> {
    await deletePlan(planId);
    this.plans = this.plans.filter((plan) => plan.id !== planId);
    try {
      this.rotation = await getRotation();
    } catch {
      // The plan is deleted; the rotation refreshes on the next load.
    }
  }

  async saveRotation(planIds: string[]): Promise<void> {
    this.rotation = await setRotation({ planIds });
  }

  async moveRotation(index: number, offset: number): Promise<void> {
    const planIds = this.rotation.plans.map((plan) => plan.id);
    const target = index + offset;
    const current = planIds[index];
    const other = planIds[target];
    if (current === undefined || other === undefined) return;
    planIds[index] = other;
    planIds[target] = current;
    await this.saveRotation(planIds);
  }

  async removeRotation(planId: string): Promise<void> {
    await this.saveRotation(
      this.rotation.plans
        .filter((plan) => plan.id !== planId)
        .map((plan) => plan.id)
    );
  }

  async addRotationPlan(planId: string): Promise<void> {
    await this.saveRotation([
      ...this.rotation.plans.map((plan) => plan.id),
      planId,
    ]);
  }

  async createExercise(input: CreateExerciseInput): Promise<Exercise> {
    const created = await createExercise(input);
    this.exercises = sortExercises([...this.exercises, created]);
    return created;
  }

  async updateExercise(
    exerciseId: string,
    input: CreateExerciseInput
  ): Promise<Exercise> {
    const updated = await updateExercise(exerciseId, input);
    this.exercises = sortExercises(
      this.exercises.map((exercise) =>
        exercise.id === exerciseId ? updated : exercise
      )
    );
    this.plans = this.plans.map((plan) => withExercise(plan, updated));
    this.rotation = {
      ...this.rotation,
      plans: this.rotation.plans.map((plan) => withExercise(plan, updated)),
    };
    return updated;
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    await deleteExercise(exerciseId);
    this.exercises = this.exercises.filter(
      (exercise) => exercise.id !== exerciseId
    );
  }

  reset(): void {
    this.exercises = [];
    this.plans = [];
    this.rotation = { plans: [], nextPlanId: null };
    this.loading = true;
    this.error = null;
    this.loaded = false;
    this.inFlight = null;
  }
}

export const gymData = new GymData();
