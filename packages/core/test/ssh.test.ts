import { describe, expect, test } from "bun:test";

import {
  buildSshArgv,
  ConfigError,
  formatSshCommand,
  KeyStorageError,
  SSH_PORT,
  sshHostFromApiUrl,
} from "../src/index.js";

describe("ssh helpers", () => {
  test("derives the host from the API URL", () => {
    expect(sshHostFromApiUrl("https://aerol.example.com")).toBe("aerol.example.com");
    expect(sshHostFromApiUrl("127.0.0.1:8080")).toBe("127.0.0.1");
  });

  test("builds the documented ssh invocation", () => {
    const argv = buildSshArgv({
      sandboxId: "sb-0123456789abcdef",
      host: "aerol.example.com",
      keyPath: "/home/me/.config/lewdev/keys/sb-0123456789abcdef",
    });
    expect(argv).toEqual([
      "ssh",
      "-i",
      "/home/me/.config/lewdev/keys/sb-0123456789abcdef",
      "-p",
      "2220",
      "sb-0123456789abcdef@aerol.example.com",
    ]);
    expect(SSH_PORT).toBe(2220);
  });

  test("formats a copyable command and quotes a key path with spaces", () => {
    expect(
      formatSshCommand({
        sandboxId: "sb-abc",
        host: "localhost",
        keyPath: "/tmp/my key",
      }),
    ).toBe("ssh -i '/tmp/my key' -p 2220 sb-abc@localhost");
  });

  test("rejects invalid hosts, IDs and ports", () => {
    expect(() => sshHostFromApiUrl("ftp://example.com")).toThrow(ConfigError);
    expect(() =>
      buildSshArgv({ sandboxId: "../escape", host: "localhost", keyPath: "/tmp/key" }),
    ).toThrow(KeyStorageError);
    expect(() =>
      buildSshArgv({ sandboxId: "sb-abc", host: "localhost", keyPath: "/tmp/key", port: 0 }),
    ).toThrow("Invalid SSH port");
  });
});
