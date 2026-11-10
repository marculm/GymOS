type ShutdownSteps = {
  stopServer: () => void | Promise<void>;
  disconnect: () => void | Promise<void>;
  exit: () => void;
  logError: (error: unknown) => void;
};

export function createShutdown({
  stopServer,
  disconnect,
  exit,
  logError,
}: ShutdownSteps) {
  let shuttingDown = false;

  const run = async (step: () => void | Promise<void>) => {
    try {
      await step();
    } catch (error) {
      logError(error);
    }
  };

  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    await run(stopServer);
    await run(disconnect);
    exit();
  };
}
