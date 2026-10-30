import type { PrismaClient, User } from "@prisma/client";
import { createMiddleware } from "hono/factory";
import { currentUserEmail } from "../config/env.mts";
import { prisma } from "../config/prisma-client.mts";
import { CurrentUserNotFoundError } from "./errors.mts";

export type AppEnv = {
  Variables: {
    user: User;
  };
};

export class CurrentUserService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async get(): Promise<User> {
    const email = currentUserEmail();
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) {
      throw new CurrentUserNotFoundError(
        `User ${email} not found. Set GYMOS_USER_EMAIL=${email} and run bun run db:seed.`
      );
    }
    return user;
  }
}

export function currentUserMiddleware(service: CurrentUserService) {
  return createMiddleware<AppEnv>(async (c, next) => {
    c.set("user", await service.get());
    await next();
  });
}
