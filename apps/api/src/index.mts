import { app } from "./app.mts";
import { connectDB, disconnectDB } from "./config/prisma-client.mts";
import { serverConfig } from "./config/server.mts";
import { container } from "./container.mts";
import { getLogger } from "./logger/logger.mts";
import { RestTimerScheduler } from "./modules/push/scheduler/rest-timer-scheduler.mts";
import { createShutdown } from "./shutdown.mts";

const logger = getLogger("index", "file");

await connectDB();

const server = Bun.serve({
  port: serverConfig.port,
  hostname: serverConfig.hostname,
  fetch: app.fetch,
});

const scheduler = container.pushService.isConfigured()
  ? new RestTimerScheduler(container.restTimerRepository, container.pushService)
  : null;
scheduler?.start();

logger.info(`GymOS API listening on ${server.url}`);

const shutdown = createShutdown({
  stopServer: async () => {
    scheduler?.stop();
    await server.stop();
  },
  disconnect: disconnectDB,
  exit: () => process.exit(0),
  logError: (error) => logger.error({ err: error }, "Shutdown step failed"),
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
