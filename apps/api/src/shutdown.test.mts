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

  it("runs shutdown once for repeated signals", async () => {
    let finishStopping!: () => void;
    const stopping = new Promise<void>((resolve) => (finishStopping = resolve));
    const stopServer = vi.fn(() => stopping);
    const disconnect = vi.fn();
    const exit = vi.fn();
    const shutdown = createShutdown({ stopServer, disconnect, exit });

    const first = shutdown();
    const repeated = shutdown();
    finishStopping();
    await Promise.all([first, repeated]);
    await shutdown();

    expect(stopServer).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });
});
