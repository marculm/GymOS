import type { Exercise } from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { toExercise } from "./mapping.mts";

export class ExerciseRepository {
  async findAll({ skip, take }: { skip: number; take: number }): Promise<Exercise[]> {
    const exercises = await prisma.exercise.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
    });
    return exercises.map(toExercise);
  }

  async count(): Promise<number> {
    return prisma.exercise.count();
  }

  async findIds(ids: string[]): Promise<string[]> {
    const exercises = await prisma.exercise.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return exercises.map((exercise) => exercise.id);
  }
}
