import { Prisma } from "@prisma/client";
import type {
  CreateExerciseInput,
  Exercise,
  UpdateExerciseInput,
} from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { DuplicateExerciseNameError } from "../service/errors.mts";
import { toExercise } from "./mapping.mts";

const active = { deletedAt: null };

function toData(input: CreateExerciseInput | UpdateExerciseInput) {
  return {
    name: input.name,
    muscleGroup: input.muscleGroup,
    description: input.description ?? null,
    defaultSets: input.defaultSets ?? 3,
    defaultReps: input.defaultReps ?? 8,
    defaultWeightKg: input.defaultWeightKg ?? null,
  };
}

function rethrowDuplicateName(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new DuplicateExerciseNameError("An exercise with this name already exists");
  }
  throw error;
}

export class ExerciseRepository {
  async findAll({ skip, take }: { skip: number; take: number }): Promise<Exercise[]> {
    const exercises = await prisma.exercise.findMany({
      where: active,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    return exercises.map(toExercise);
  }

  async count(): Promise<number> {
    return prisma.exercise.count({ where: active });
  }

  async findIds(ids: string[]): Promise<string[]> {
    const exercises = await prisma.exercise.findMany({
      where: { id: { in: ids }, ...active },
      select: { id: true },
    });
    return exercises.map((exercise) => exercise.id);
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    try {
      const exercise = await prisma.exercise.create({ data: toData(input) });
      return toExercise(exercise);
    } catch (error) {
      rethrowDuplicateName(error);
    }
  }

  async update(id: string, input: UpdateExerciseInput): Promise<Exercise | null> {
    try {
      const exercise = await prisma.exercise.update({
        where: { id, ...active },
        data: toData(input),
      });
      return toExercise(exercise);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      rethrowDuplicateName(error);
    }
  }

  async softDelete(id: string): Promise<Exercise | null> {
    try {
      const exercise = await prisma.exercise.update({
        where: { id, ...active },
        data: { deletedAt: new Date() },
      });
      return toExercise(exercise);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      throw error;
    }
  }
}
