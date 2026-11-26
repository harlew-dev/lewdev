import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSshArgv,
  ConfigError,
  ensureKnownHostsFile,
  forgetHostKey,
  formatSshCommand,
  type GatewayHostKey,
  getKnownHostsPath,
  knownHostsEntry,
  KeyStorageError,
  saveGatewayHostKeys,
  scanGatewayHostKeys,
  SSH_PORT,
  sshHostFromApiUrl,
} from "../src/index.js";

const posixModes = process.platform !== "win32";
const hasSshKeygen = Bun.which("ssh-keygen") !== null;

// Windows directory protection shells out to PowerShell, which can be slow to start.
setDefaultTimeout(30_000);

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
      "-o",
      "IdentitiesOnly=yes",
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
    ).toBe("ssh -i '/tmp/my key' -p 2220 -o IdentitiesOnly=yes sb-abc@localhost");
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
      "IdentitiesOnly=yes",
      "-o",
      "UserKnownHostsFile=/cfg/lewdev/known_hosts",
      "sb-abc@aerol.example.com",
    ]);
    expect(formatSshCommand({ ...target, knownHostsPath: "/my cfg/known_hosts" })).toBe(
      "ssh -i /k/sb-abc -p 2220 -o IdentitiesOnly=yes -o 'UserKnownHostsFile=/my cfg/known_hosts' sb-abc@aerol.example.com",
    );
  });

  test("formats known_hosts entries and rejects unsafe hosts", () => {
    expect(knownHostsEntry("aerol.example.com")).toBe("[aerol.example.com]:2220");
    expect(knownHostsEntry("aerol.example.com", 22)).toBe("aerol.example.com");
    for (const bad of ["", "-oProxy", "a b", "a,b", "*.example.com", "[x]"]) {
      expect(() => knownHostsEntry(bad)).toThrow("Invalid SSH host");
    }
  });

  test("creates the known_hosts file in the config dir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lewdev-kh-"));
    const env = { XDG_CONFIG_HOME: dir };
    try {
      expect(await forgetHostKey("gw.example.test", 2220, env)).toBe(false);

      const path = await ensureKnownHostsFile(env);
      expect(path).toBe(getKnownHostsPath(env));
      if (posixModes) {
        expect((await stat(path)).mode & 0o777).toBe(0o600);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(!hasSshKeygen)("forgets only the gateway entry with ssh-keygen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lewdev-kh-"));
    const env = { XDG_CONFIG_HOME: dir };
    try {
      const path = await ensureKnownHostsFile(env);

      const key =
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHX4t6KUKuw2kz9jpzjR+jTLn8dXd5b7aFCHYRcXojRv";
      await writeFile(path, `[gw.example.test]:2220 ${key}\n[other.example.test]:2220 ${key}\n`);
      expect(await forgetHostKey("gw.example.test", 2220, env)).toBe(true);
      const remaining = await readFile(path, "utf8");
      expect(remaining).not.toContain("gw.example.test");
      expect(remaining).toContain("other.example.test");
      if (posixModes) {
        expect((await stat(path)).mode & 0o777).toBe(0o600);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

const ED25519_KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIHX4t6KUKuw2kz9jpzjR+jTLn8dXd5b7aFCHYRcXojRv";
const SECOND_KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIExampleSecondKeyBlobForTestsOnly000000";

describe("gateway host key scan", () => {
  test("scans every address, uses the gateway entry and merges identical keys", async () => {
    const scan = await scanGatewayHostKeys("gw.example.test", {
      resolve: async () => ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
      keyscan: async (address) => {
        if (address === "10.0.0.1") {
          return `10.0.0.1 ssh-ed25519 ${ED25519_KEY}\n# comment\n`;
        }
        if (address === "10.0.0.2") {
          return `10.0.0.2 ssh-ed25519 ${ED25519_KEY}`;
        }
        return `10.0.0.3 ssh-ed25519 ${SECOND_KEY}`;
      },
    });

    expect(scan.entry).toBe("[gw.example.test]:2220");
    expect(scan.failedAddresses).toEqual([]);
    expect(scan.keys).toHaveLength(2);
    expect(scan.keys[0]).toMatchObject({
      algorithm: "ssh-ed25519",
      blob: ED25519_KEY,
      fingerprint: "SHA256:XFlNmsQ+aCf/fB43wg4um4d12XIsuQD+Jxdl1rAnNpI",
      addresses: ["10.0.0.1", "10.0.0.2"],
    });
    expect(scan.keys[0]?.line).toBe(`[gw.example.test]:2220 ssh-ed25519 ${ED25519_KEY}`);
    expect(scan.keys[1]?.addresses).toEqual(["10.0.0.3"]);
  });

  test("uses an IP literal without a DNS lookup", async () => {
    const scanned: string[] = [];
    const scan = await scanGatewayHostKeys("203.0.113.7", {
      keyscan: async (address) => {
        scanned.push(address);
        return `${address} ssh-ed25519 ${ED25519_KEY}\n`;
      },
    });

    expect(scanned).toEqual(["203.0.113.7"]);
    expect(scan.entry).toBe("[203.0.113.7]:2220");
  });

  test("reports addresses that could not be scanned but keeps the rest", async () => {
    const scan = await scanGatewayHostKeys("gw.example.test", {
      resolve: async () => ["10.0.0.1", "10.0.0.2"],
      keyscan: async (address) => {
        if (address === "10.0.0.2") {
          throw new Error("timed out");
        }
        return `10.0.0.1 ssh-ed25519 ${ED25519_KEY}\n`;
      },
    });

    expect(scan.keys).toHaveLength(1);
    expect(scan.failedAddresses).toEqual(["10.0.0.2"]);
  });

  test("fails when no address returns a key", async () => {
    await expect(
      scanGatewayHostKeys("gw.example.test", {
        resolve: async () => ["10.0.0.1"],
        keyscan: async () => "# no keys\n",
      }),
    ).rejects.toThrow("No host keys came back");
  });

  test("explains a missing ssh-keyscan", async () => {
    const missing = Object.assign(new Error("spawn ssh-keyscan ENOENT"), { code: "ENOENT" });

    await expect(
      scanGatewayHostKeys("gw.example.test", {
        resolve: async () => ["10.0.0.1"],
        keyscan: async () => {
          throw missing;
        },
      }),
    ).rejects.toThrow("ssh-keyscan was not found");
  });
});

describe("gateway host key saving", () => {
  function hostKey(blob: string): GatewayHostKey {
    return {
      line: `[gw.example.test]:2220 ssh-ed25519 ${blob}`,
      algorithm: "ssh-ed25519",
      blob,
      fingerprint: "SHA256:unused",
      addresses: ["10.0.0.1"],
    };
  }

  test.skipIf(!hasSshKeygen)("replaces gateway entries and keeps other hosts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lewdev-kh-"));
    const env = { XDG_CONFIG_HOME: dir };
    const oldKey = "AAAAC3NzaC1lZDI1NTE5AAAAIOldGatewayKeyThatShouldBeReplaced000000000000";
    try {
      const path = await ensureKnownHostsFile(env);
      await writeFile(
        path,
        `[gw.example.test]:2220 ssh-ed25519 ${oldKey}\n[other.example.test]:2220 ssh-ed25519 ${oldKey}\n`,
      );

      await saveGatewayHostKeys(
        "gw.example.test",
        [hostKey(ED25519_KEY), hostKey(SECOND_KEY)],
        2220,
        env,
      );

      const remaining = await readFile(path, "utf8");
      expect(remaining).not.toContain(`[gw.example.test]:2220 ssh-ed25519 ${oldKey}`);
      expect(remaining).toContain(`[gw.example.test]:2220 ssh-ed25519 ${ED25519_KEY}`);
      expect(remaining).toContain(`[gw.example.test]:2220 ssh-ed25519 ${SECOND_KEY}`);
      expect(remaining).toContain(`[other.example.test]:2220 ssh-ed25519 ${oldKey}`);
      if (posixModes) {
        expect((await stat(path)).mode & 0o777).toBe(0o600);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
