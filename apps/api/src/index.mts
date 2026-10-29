import { app } from "./app.mts";
import { connectDB, disconnectDB } from "./config/prisma-client.mts";
import { serverConfig } from "./config/server.mts";
import { getLogger } from "./logger/logger.mts";

const logger = getLogger("index", "file");

await connectDB();

const server = Bun.serve({
  port: serverConfig.port,
  hostname: serverConfig.hostname,
  fetch: app.fetch,
});

logger.info(`GymOS API listening on ${server.url}`);

const shutdown = async () => {
  await disconnectDB();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
