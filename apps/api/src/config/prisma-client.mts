import { PrismaClient } from "@prisma/client";
import { env } from "./env.mts";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export async function connectDB() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to start the API");
  }
  await prisma.$connect();
}

export async function disconnectDB() {
  await prisma.$disconnect();
}
