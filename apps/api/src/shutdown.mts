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
  return async () => {
    await stopServer();
    await disconnect();
    exit();
  };
}
