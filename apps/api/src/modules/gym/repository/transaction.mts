import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/prisma-client.mts";
import { ConcurrentUpdateError } from "../service/errors.mts";

export async function withSerializableRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable) throw error;
      if (attempt >= 2) throw new ConcurrentUpdateError("Concurrent update, retry");
    }
  }
}
