import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSshArgv,
  ConfigError,
  ensureKnownHostsFile,
  forgetHostKey,
  formatSshCommand,
  getKnownHostsPath,
  knownHostsEntry,
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

describe("lewdev known_hosts", () => {
  test("ssh uses lewdev's known_hosts file when one is given", () => {
    const target = {
      sandboxId: "sb-abc",
      host: "aerol.example.com",
      keyPath: "/k/sb-abc",
      knownHostsPath: "/cfg/lewdev/known_hosts",
    };
    expect(buildSshArgv(target)).toEqual([
      "ssh",
      "-i",
      "/k/sb-abc",
      "-p",
      "2220",
      "-o",
      "UserKnownHostsFile=/cfg/lewdev/known_hosts",
      "sb-abc@aerol.example.com",
    ]);
    expect(formatSshCommand({ ...target, knownHostsPath: "/my cfg/known_hosts" })).toBe(
      "ssh -i /k/sb-abc -p 2220 -o 'UserKnownHostsFile=/my cfg/known_hosts' sb-abc@aerol.example.com",
    );
  });

  test("formats known_hosts entries and rejects unsafe hosts", () => {
    expect(knownHostsEntry("aerol.example.com")).toBe("[aerol.example.com]:2220");
    expect(knownHostsEntry("aerol.example.com", 22)).toBe("aerol.example.com");
    for (const bad of ["", "-oProxy", "a b", "a,b", "*.example.com", "[x]"]) {
      expect(() => knownHostsEntry(bad)).toThrow("Invalid SSH host");
    }
  });

  test("creates the file privately and forgets only the gateway entry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lewdev-kh-"));
    const env = { XDG_CONFIG_HOME: dir };
    try {
      const path = await ensureKnownHostsFile(env);
      expect(path).toBe(getKnownHostsPath(env));
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(await forgetHostKey("gw.example.test", 2220, env)).toBe(false);

      const key =
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHX4t6KUKuw2kz9jpzjR+jTLn8dXd5b7aFCHYRcXojRv";
      await writeFile(path, `[gw.example.test]:2220 ${key}\n[other.example.test]:2220 ${key}\n`);
      expect(await forgetHostKey("gw.example.test", 2220, env)).toBe(true);
      const remaining = await readFile(path, "utf8");
      expect(remaining).not.toContain("gw.example.test");
      expect(remaining).toContain("other.example.test");
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
