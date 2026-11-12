import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env.mts";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Match Prisma 6's 5-second connect timeout; pg defaults to none.
  connectionTimeoutMillis: 5000,
});

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
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
