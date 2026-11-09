import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "./shutdown.mts";

describe("createShutdown", () => {
  it("stops the server before disconnecting the database", async () => {
    const calls: string[] = [];
    const shutdown = createShutdown({
      stopServer: () => {
        calls.push("stopServer");
      },
      disconnect: () => {
        calls.push("disconnect");
      },
      exit: () => {
        calls.push("exit");
      },
    });

    await shutdown();

    expect(calls).toEqual(["stopServer", "disconnect", "exit"]);
  });

  it("waits for the server to stop before disconnecting", async () => {
    let finishStopping!: () => void;
    const stopServer = vi.fn(
      () => new Promise<void>((resolve) => (finishStopping = resolve))
    );
    const disconnect = vi.fn();
    const shutdown = createShutdown({
      stopServer,
      disconnect,
      exit: vi.fn(),
    });

    const shutdownDone = shutdown();
    await Promise.resolve();

    expect(disconnect).not.toHaveBeenCalled();

    finishStopping();
    await shutdownDone;

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
