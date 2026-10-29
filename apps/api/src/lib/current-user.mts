import { HTTPException } from "hono/http-exception";
import { prisma } from "../config/prisma-client.mts";

const DEFAULT_USER_EMAIL = "demo@gymos.app";

export async function getCurrentUser() {
  const email = process.env.GYMOS_USER_EMAIL ?? DEFAULT_USER_EMAIL;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HTTPException(500, {
      message: `User ${email} not found. Run bun run db:seed.`,
    });
  }
  return user;
}
