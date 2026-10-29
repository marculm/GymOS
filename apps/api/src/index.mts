import { app } from "./app.mts";
import { env } from "./config/env.mts";
import { connectDB, disconnectDB } from "./config/prisma-client.mts";
import { getLogger } from "./logger/logger.mts";

const logger = getLogger("index", "file");

await connectDB();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

logger.info(`GymOS API listening on ${server.url}`);

const shutdown = async () => {
  await disconnectDB();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
