type ShutdownSteps = {
  stopServer: () => void | Promise<void>;
  disconnect: () => void | Promise<void>;
  exit: () => void;
};

export function createShutdown({
  stopServer,
  disconnect,
  exit,
}: ShutdownSteps) {
  let shuttingDown = false;

  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    await stopServer();
    await disconnect();
    exit();
  };
}
