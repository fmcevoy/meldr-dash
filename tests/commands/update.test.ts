import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe("runUpdate", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.exitCode = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  async function loadRunUpdate() {
    const mod = await import("../../src/commands/update.js");
    return mod.runUpdate;
  }

  it("prints up-to-date when versions match", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "0.1.0" }),
    }) as unknown as typeof fetch;

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const runUpdate = await loadRunUpdate();
    await runUpdate();

    expect(log).toHaveBeenCalledWith(expect.stringContaining("up to date"));
    log.mockRestore();
  });

  it("runs npm install -g when update is available", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    }) as unknown as typeof fetch;

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const runUpdate = await loadRunUpdate();
    await runUpdate();

    expect(mockedExecSync).toHaveBeenCalledWith(
      "npm install -g meldr-dash@latest",
      { stdio: "inherit" },
    );
    log.mockRestore();
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const runUpdate = await loadRunUpdate();
    await runUpdate();

    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("Failed to check for updates"),
    );
    expect(process.exitCode).toBe(1);
    log.mockRestore();
    err.mockRestore();
  });

  it("handles npm install failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    }) as unknown as typeof fetch;
    mockedExecSync.mockImplementation(() => {
      throw new Error("permission denied");
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const runUpdate = await loadRunUpdate();
    await runUpdate();

    expect(err).toHaveBeenCalledWith(expect.stringContaining("Update failed"));
    expect(process.exitCode).toBe(1);
    log.mockRestore();
    err.mockRestore();
  });
});
