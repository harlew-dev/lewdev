import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  addAuthorizedKey,
  addSshInclude,
  type AerolSdk,
  cleanupDirectSsh,
  type DirectSshProgress,
  DirectSshError,
  directKeyExists,
  disableDirectSsh,
  enablePublicDirectSsh,
  ensureDirectKey,
  formatDirectSshCommand,
  formatExplicitSshCommand,
  getConfigDir,
  getDirectKeyPath,
  getKnownHostsPath,
  getSshConfigPath,
  getLewdevCommand,
  getSshIncludeLine,
  hasDirectSshConfigBlock,
  hasSshInclude,
  LewdevApi,
  parseAuthorizedKeys,
  parsePublicKey,
  readDirectPublicKey,
  readDirectSshConfigBlock,
  removeDirectSshConfigBlock,
  resetDirectSsh,
  type SdkSandbox,
  saveDirectHostKeys,
  setupDirectSsh,
  switchToPrivateSsh,
  validatePublicKey,
  writeDirectSshConfigBlock,
} from "../src/index.js";

const posixModes = process.platform !== "win32";
const hasSshKeygen = Bun.which("ssh-keygen") !== null;
const ED25519_KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIHX4t6KUKuw2kz9jpzjR+jTLn8dXd5b7aFCHYRcXojRv";
const ED25519_LINE = `ssh-ed25519 ${ED25519_KEY} lewdev-sb-abc`;
const HOST_KEY = `ssh-ed25519 ${ED25519_KEY}`;

setDefaultTimeout(30_000);

let root = "";
let home = "";
let env: Record<string, string> = {};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lewdev-direct-"));
  home = await mkdtemp(join(tmpdir(), "lewdev-home-"));
  env = { XDG_CONFIG_HOME: root };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

describe("public key parsing", () => {
  test("accepts one OpenSSH public key line and fingerprints it", () => {
    const key = validatePublicKey(`  ${ED25519_LINE}  `);
    expect(key.type).toBe("ssh-ed25519");
    expect(key.comment).toBe("lewdev-sb-abc");
    expect(key.fingerprint).toBe("SHA256:XFlNmsQ+aCf/fB43wg4um4d12XIsuQD+Jxdl1rAnNpI");
  });

  test("rejects private keys, multiple lines, options and garbage", () => {
    for (const value of [
      "",
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      `ssh-ed25519 ${ED25519_KEY}\nssh-ed25519 ${ED25519_KEY}`,
      `from="10.0.0.1" ssh-ed25519 ${ED25519_KEY}`,
      "not a key",
    ]) {
      expect(() => validatePublicKey(value)).toThrow(DirectSshError);
    }
    expect(parsePublicKey("")).toBeNull();
  });

  test("parses authorized_keys with options and marks lewdev's key", () => {
    const keys = parseAuthorizedKeys(
      [
        `# comment`,
        `${ED25519_LINE}`,
        `from="10.0.0.1" ssh-ed25519 ${ED25519_KEY} someone`,
        "not a key",
      ].join("\n"),
      ED25519_LINE,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]?.isLewdev).toBe(true);
    expect(keys[1]?.isLewdev).toBe(true);
    expect(keys[1]?.comment).toBe("someone");
  });
});

describe("direct SSH files", () => {
  test("writes, replaces and removes one ssh_config block per sandbox", async () => {
    const block = (port: number) => ({
      alias: "lewdev-sb-abc",
      mode: "public" as const,
      host: "eu.example.test",
      port,
      keyPath: "/cfg/keys/sb-abc.direct",
      knownHostsPath: "/cfg/known_hosts",
    });

    await writeDirectSshConfigBlock(block(22042), env);
    const path = getSshConfigPath(env);
    let content = await readFile(path, "utf8");
    expect(content).toContain("Host lewdev-sb-abc");
    expect(content).toContain("HostName eu.example.test");
    expect(content).toContain("Port 22042");
    expect(content).toContain("User root");
    expect(content).toContain("IdentitiesOnly yes");
    expect(content).toContain("StrictHostKeyChecking yes");
    if (posixModes) {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }

    await writeDirectSshConfigBlock({ ...block(22043), host: "eu2.example.test" }, env);
    content = await readFile(path, "utf8");
    expect(content.match(/^Host lewdev-sb-abc$/gm)).toHaveLength(1);
    expect(content).toContain("Port 22043");
    expect(content).not.toContain("22042");

    expect(await hasDirectSshConfigBlock("sb-abc", env)).toBe(true);
    expect(await readDirectSshConfigBlock("sb-abc", env)).toMatchObject({
      host: "eu2.example.test",
      port: 22043,
    });
    expect(await removeDirectSshConfigBlock("sb-abc", env)).toBe(true);
    expect(await removeDirectSshConfigBlock("sb-abc", env)).toBe(false);
    expect(await hasDirectSshConfigBlock("sb-abc", env)).toBe(false);
  });

  test("quotes paths with spaces in the config and explicit command", () => {
    const dir = join(root, "with space");
    const block = {
      alias: "lewdev-sb-abc",
      mode: "public" as const,
      host: "eu.example.test",
      port: 22042,
      keyPath: join(dir, "sb-abc.direct"),
      knownHostsPath: join(dir, "known_hosts"),
    };
    const command = formatExplicitSshCommand(block);
    expect(command).toContain(`-i '${block.keyPath}'`);
    expect(command).toContain(`UserKnownHostsFile='${block.knownHostsPath}'`);
    expect(command).toContain("root@eu.example.test");
    expect(formatDirectSshCommand("sb-abc")).toBe("ssh lewdev-sb-abc");
  });

  test("builds a quoted ProxyCommand for compiled and source builds", () => {
    expect(
      getLewdevCommand({
        standalone: true,
        execPath: "/opt/lew dev/lewdev",
      }),
    ).toBe('"/opt/lew dev/lewdev"');
    expect(
      getLewdevCommand({
        standalone: false,
        execPath: "/usr/bin/bun",
        main: "/work/apps/tui/src/index.tsx",
      }),
    ).toBe(`/usr/bin/bun ${resolve("/work/apps/tui/src/index.tsx").replaceAll("\\", "/")}`);
  });

  test("formats a private explicit command with ProxyCommand and HostKeyAlias", () => {
    const block = {
      alias: "lewdev-sb-abc",
      mode: "private" as const,
      keyPath: "/cfg/my key",
      knownHostsPath: "/cfg/known_hosts",
      proxyCommand: "/opt/lew dev/lewdev ssh-proxy sb-abc",
      hostKeyAlias: "lewdev-sb-abc",
    };
    const command = formatExplicitSshCommand(block);
    expect(command).toContain(`ProxyCommand='/opt/lew dev/lewdev ssh-proxy sb-abc'`);
    expect(command).toContain("HostKeyAlias=lewdev-sb-abc");
    expect(command).toContain(`-i '/cfg/my key'`);
    expect(command).toContain("root@lewdev-sb-abc");
  });

  test("adds lewdev's Include once, at the top, and keeps existing bytes", async () => {
    const sshDir = join(home, ".ssh");
    const path = join(sshDir, "config");
    const existing = "Host mine\n    HostName example.test\n";
    await writeFile(join(home, "placeholder"), "");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(sshDir, { recursive: true, mode: 0o700 });
    await writeFile(path, existing, { mode: 0o600 });

    expect(await hasSshInclude({ env, homeDir: home })).toBe(false);
    expect(await addSshInclude({ env, homeDir: home })).toBe(true);
    const content = await readFile(path, "utf8");
    expect(content.startsWith(`# Added by lewdev\n${getSshIncludeLine(env)}\n`)).toBe(true);
    expect(content.endsWith(existing)).toBe(true);
    expect(await hasSshInclude({ env, homeDir: home })).toBe(true);
    expect(await addSshInclude({ env, homeDir: home })).toBe(false);
    expect((await readFile(path, "utf8")).match(/Added by lewdev/g)).toHaveLength(1);
  });

  test("creates ~/.ssh and its config with private modes", async () => {
    const path = join(home, ".ssh", "config");
    expect(await addSshInclude({ env, homeDir: home })).toBe(true);
    if (posixModes) {
      expect((await stat(join(home, ".ssh"))).mode & 0o777).toBe(0o700);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
    expect(await readFile(path, "utf8")).toContain(getSshIncludeLine(env));
  });

  test("replaces only the named known_hosts entry", async () => {
    const path = getKnownHostsPath(env);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(getConfigDir(env), { recursive: true });
    await writeFile(
      path,
      `[eu.example.test]:22042 ssh-ed25519 ${ED25519_KEY}\n[other.test]:22042 ssh-ed25519 ${ED25519_KEY}\n`,
      { mode: 0o600 },
    );

    await saveDirectHostKeys(
      "eu.example.test",
      22042,
      [parsePublicKey(HOST_KEY) as NonNullable<ReturnType<typeof parsePublicKey>>],
      env,
    );
    const content = await readFile(path, "utf8");
    expect(content.match(/\[eu\.example\.test\]:22042/g)).toHaveLength(1);
    expect(content).toContain("[other.test]:22042");
    if (posixModes) {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  });
});

describe("direct key storage", () => {
  test.skipIf(!hasSshKeygen)("generates the direct key next to the gateway key", async () => {
    const { ensureDirectKey } = await import("../src/index.js");
    const key = await ensureDirectKey("sb-abc", env);
    expect(key.privateKeyPath).toBe(getDirectKeyPath("sb-abc", env));
    expect(key.publicKey).toStartWith("ssh-ed25519 ");
    expect(key.publicKey).toEndWith("lewdev-sb-abc");
    expect(await directKeyExists("sb-abc", env)).toBe(true);
    if (posixModes) {
      expect((await stat(key.privateKeyPath)).mode & 0o777).toBe(0o600);
    }
    const again = await ensureDirectKey("sb-abc", env);
    expect(again.publicKey).toBe(key.publicKey);
  });
});

interface FakeCall {
  method: string;
  args: unknown[];
}

function fakeApi(responses: {
  exec?: Array<{ stdout?: string; stderr?: string; exitCode?: number }>;
  onUpload?: (path: string, data: string) => void;
  exposed?: { host: string; hostPort: number };
}) {
  const calls: FakeCall[] = [];
  const queue = [...(responses.exec ?? [])];
  const api = {
    async exec(id: string, command: string, options?: { timeoutSeconds?: number }) {
      calls.push({ method: "exec", args: [id, command, options] });
      const next = queue.shift() ?? { stdout: "", stderr: "", exitCode: 0 };
      return {
        stdout: next.stdout ?? "",
        stderr: next.stderr ?? "",
        exitCode: next.exitCode ?? 0,
        timedOut: false,
      };
    },
    async uploadFile(id: string, path: string, data: string, options?: unknown) {
      calls.push({ method: "uploadFile", args: [id, path, data, options] });
      responses.onUpload?.(path, data);
    },
    async openTcpPort(id: string, port: number) {
      calls.push({ method: "openTcpPort", args: [id, port] });
      return {
        port,
        url: `tcp://${responses.exposed?.host ?? "eu.example.test"}:${responses.exposed?.hostPort ?? 22042}`,
        protocol: "tcp",
        host: responses.exposed?.host ?? "eu.example.test",
        hostPort: responses.exposed?.hostPort ?? 22042,
      };
    },
    async getSandbox(id: string) {
      calls.push({ method: "getSandbox", args: [id] });
      return { id, exposedPorts: [] };
    },
    async closePort(id: string, port: number) {
      calls.push({ method: "closePort", args: [id, port] });
    },
  };
  return { api: api as never, calls };
}

describe("setup and cleanup", () => {
  test.skipIf(!hasSshKeygen)(
    "private setup writes a ProxyCommand block and exposes no port",
    async () => {
      const { api, calls } = fakeApi({
        exec: [{ exitCode: 0 }, {}, {}, { stdout: `${HOST_KEY} root@eu\n` }],
      });
      const progress: DirectSshProgress[] = [];
      const proxyCommand = "/opt/lew dev/lewdev ssh-proxy sb-abc";

      const result = await setupDirectSsh(api, "sb-abc", {
        env,
        homeDir: home,
        mode: "private",
        proxyCommand,
        onProgress: (entry) => progress.push(entry),
      });

      expect(result).toMatchObject({ alias: "lewdev-sb-abc", mode: "private" });
      expect(result.host).toBeUndefined();
      expect(result.port).toBeUndefined();
      expect(progress.find((entry) => entry.step === "port")?.status).toBe("skipped");
      expect(calls.filter((call) => call.method === "openTcpPort")).toEqual([]);
      const block = await readDirectSshConfigBlock("sb-abc", env);
      expect(block).toMatchObject({
        mode: "private",
        proxyCommand,
        hostKeyAlias: "lewdev-sb-abc",
      });
      const config = await readFile(getSshConfigPath(env), "utf8");
      expect(config).toContain(`ProxyCommand ${proxyCommand}`);
      expect(config).toContain("HostKeyAlias lewdev-sb-abc");
      expect(config).not.toContain("HostName");
      const knownHosts = await readFile(getKnownHostsPath(env), "utf8");
      expect(knownHosts).toContain("lewdev-sb-abc ssh-ed25519");
      expect(knownHosts).not.toContain("[lewdev-sb-abc]");
    },
  );

  test.skipIf(!hasSshKeygen)("runs every step in order and writes local state", async () => {
    const { api, calls } = fakeApi({
      exec: [{ exitCode: 0 }, {}, {}, { stdout: `${HOST_KEY} root@eu\n` }],
    });
    const progress: DirectSshProgress[] = [];

    const result = await setupDirectSsh(api, "sb-abc", {
      env,
      homeDir: home,
      mode: "public",
      onProgress: (entry) => progress.push(entry),
    });

    expect(progress.map((entry) => `${entry.step}:${entry.status}`)).toEqual([
      "package:running",
      "package:done",
      "key:running",
      "key:done",
      "authorized-key:running",
      "authorized-key:done",
      "sshd:running",
      "sshd:done",
      "port:running",
      "port:done",
      "host-key:running",
      "host-key:done",
      "config:running",
      "config:done",
    ]);
    expect(result).toMatchObject({
      alias: "lewdev-sb-abc",
      mode: "public",
      host: "eu.example.test",
      port: 22042,
      includePresent: false,
    });
    expect(await hasDirectSshConfigBlock("sb-abc", env)).toBe(true);
    expect(await readFile(getSshConfigPath(env), "utf8")).toContain("Port 22042");
    expect(await readFile(getKnownHostsPath(env), "utf8")).toContain("[eu.example.test]:22042");
    expect(calls.filter((call) => call.method === "openTcpPort")).toEqual([
      { method: "openTcpPort", args: ["sb-abc", 22] },
    ]);
    const upload = calls.find((call) => call.method === "uploadFile");
    expect(upload?.args[1]).toBe("/etc/ssh/sshd_config.d/00-lewdev.conf");
    expect(String(upload?.args[2])).toContain("PasswordAuthentication no");
  });

  test.skipIf(!hasSshKeygen)("switches between private and public modes", async () => {
    await ensureDirectKey("sb-abc", env);
    await writeDirectSshConfigBlock(
      {
        alias: "lewdev-sb-abc",
        mode: "private",
        keyPath: getDirectKeyPath("sb-abc", env),
        knownHostsPath: getKnownHostsPath(env),
        proxyCommand: "lewdev ssh-proxy sb-abc",
        hostKeyAlias: "lewdev-sb-abc",
      },
      env,
    );
    const { api } = fakeApi({
      exec: [
        { exitCode: 0 },
        { stdout: `${HOST_KEY} root@eu\n` },
        { exitCode: 0 },
        { stdout: `${HOST_KEY} root@eu\n` },
        { exitCode: 0 },
      ],
    });

    const publicBlock = await enablePublicDirectSsh(api, "sb-abc", { env });
    expect(publicBlock).toMatchObject({ mode: "public", host: "eu.example.test", port: 22042 });
    expect(await readFile(getSshConfigPath(env), "utf8")).toContain("HostName eu.example.test");
    expect(await readFile(getKnownHostsPath(env), "utf8")).toContain("[eu.example.test]:22042");

    const privateBlock = await switchToPrivateSsh(api, "sb-abc", {
      env,
      proxyCommand: "lewdev ssh-proxy sb-abc",
    });
    expect(privateBlock).toMatchObject({
      mode: "private",
      proxyCommand: "lewdev ssh-proxy sb-abc",
      hostKeyAlias: "lewdev-sb-abc",
    });
    expect(await readFile(getSshConfigPath(env), "utf8")).toContain(
      "ProxyCommand lewdev ssh-proxy sb-abc",
    );
    expect(await readFile(getKnownHostsPath(env), "utf8")).toContain("lewdev-sb-abc ssh-ed25519");
  });

  test("reports a clear error when no package manager can install sshd", async () => {
    const { api, calls } = fakeApi({
      exec: [
        { exitCode: 1 },
        {
          exitCode: 42,
          stderr: "No supported package manager (apt-get, apk, dnf, yum) was found.",
        },
      ],
    });
    const progress: DirectSshProgress[] = [];
    await expect(
      setupDirectSsh(api, "sb-abc", {
        env,
        homeDir: home,
        onProgress: (entry) => progress.push(entry),
      }),
    ).rejects.toThrow("No supported package manager");
    expect(progress.at(-1)).toMatchObject({ step: "package", status: "error" });
    expect(calls.map((call) => call.method)).toEqual(["exec", "exec"]);
    expect(await directKeyExists("sb-abc", env)).toBe(false);
  });

  test.skipIf(!hasSshKeygen)(
    "reset removes the old key and local state, then sets up a fresh key",
    async () => {
      const oldKey = await ensureDirectKey("sb-abc", env);
      await writeDirectSshConfigBlock(
        {
          alias: "lewdev-sb-abc",
          mode: "public" as const,
          host: "old.example.test",
          port: 22042,
          keyPath: oldKey.privateKeyPath,
          knownHostsPath: getKnownHostsPath(env),
        },
        env,
      );
      await saveDirectHostKeys(
        "old.example.test",
        22042,
        [parsePublicKey(HOST_KEY) as NonNullable<ReturnType<typeof parsePublicKey>>],
        env,
      );

      const commands: string[] = [];
      const results = [
        { exitCode: 1 },
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0, stdout: `${HOST_KEY} root@eu\n` },
      ];
      const sandbox = {
        id: "sb-abc",
        image: "ubuntu:24.04",
        status: "started",
        publicURL: "https://sb.example.test",
        cpu: 1,
        memoryMB: 1024,
        diskGB: 10,
        osUser: "root",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        lastActiveAt: "2026-01-01T00:00:00Z",
        runtime: "docker",
        exposedPorts: [],
        exec: async (request: string | { command?: string }) => {
          const command = typeof request === "string" ? request : (request.command ?? "");
          commands.push(command);
          const next = results.shift() ?? { exitCode: 0 };
          return {
            stdout: next.stdout ?? "",
            stderr: "",
            exitCode: next.exitCode,
            durationMS: 0,
            timedOut: false,
            stdoutTruncated: false,
            stderrTruncated: false,
          };
        },
        uploadFile: async () => {},
        exposePort: async () => ({
          protocol: "tcp" as const,
          url: "tcp://new.example.test:22043",
          host: "new.example.test",
          hostPort: 22043,
        }),
        unexposePort: async () => {},
      } as unknown as SdkSandbox;
      const sdk = { get: async () => sandbox } as unknown as AerolSdk;
      const api = new LewdevApi(sdk);

      const result = await resetDirectSsh(api, "sb-abc", {
        env,
        homeDir: home,
        mode: "public",
      });

      // The removal failed (exit 1) but reset continued and set up again.
      expect(commands[0]).toContain("/root/.ssh/authorized_keys");
      expect(commands[0]).toContain(oldKey.publicKey);
      expect(result.host).toBe("new.example.test");
      expect(result.port).toBe(22043);
      const newKey = await readDirectPublicKey("sb-abc", env);
      expect(newKey).not.toBe(oldKey.publicKey);
      expect(commands.some((command) => command.includes(newKey ?? "never-matches"))).toBe(true);
      expect(await readFile(getSshConfigPath(env), "utf8")).toContain("HostName new.example.test");
      const knownHosts = await readFile(getKnownHostsPath(env), "utf8");
      expect(knownHosts).not.toContain("old.example.test");
      expect(knownHosts).toContain("[new.example.test]:22043");
    },
  );

  test.skipIf(!hasSshKeygen)(
    "disable closes the port, stops sshd and removes the config block",
    async () => {
      const { api, calls } = fakeApi({});
      await writeDirectSshConfigBlock(
        {
          alias: "lewdev-sb-abc",
          mode: "public" as const,
          host: "eu.example.test",
          port: 22042,
          keyPath: getDirectKeyPath("sb-abc", env),
          knownHostsPath: getKnownHostsPath(env),
        },
        env,
      );
      (api as unknown as { getSandbox: () => Promise<unknown> }).getSandbox = async () => ({
        id: "sb-abc",
        exposedPorts: [{ port: 22, url: "tcp://eu.example.test:22042", protocol: "tcp" }],
      });

      await disableDirectSsh(api, "sb-abc", env);
      expect(calls.map((call) => call.method)).toContain("closePort");
      expect(calls.find((call) => call.method === "closePort")?.args).toEqual(["sb-abc", 22]);
      expect(String(calls.find((call) => call.method === "exec")?.args[1])).toContain("pkill");
      expect(await hasDirectSshConfigBlock("sb-abc", env)).toBe(false);
    },
  );

  test.skipIf(!hasSshKeygen)("adds a user key but refuses private keys", async () => {
    const { api, calls } = fakeApi({});
    await addAuthorizedKey(api, "sb-abc", ED25519_LINE);
    const command = String(calls[0]?.args[1]);
    expect(command).toContain("authorized_keys");
    expect(command).toContain(ED25519_LINE);
    await expect(addAuthorizedKey(api, "sb-abc", "PRIVATE KEY")).rejects.toThrow(DirectSshError);
  });

  test.skipIf(!hasSshKeygen)("cleanup removes the block, host key and key pair", async () => {
    await writeDirectSshConfigBlock(
      {
        alias: "lewdev-sb-abc",
        mode: "public" as const,
        host: "eu.example.test",
        port: 22042,
        keyPath: getDirectKeyPath("sb-abc", env),
        knownHostsPath: getKnownHostsPath(env),
      },
      env,
    );
    await saveDirectHostKeys(
      "eu.example.test",
      22042,
      [parsePublicKey(HOST_KEY) as NonNullable<ReturnType<typeof parsePublicKey>>],
      env,
    );
    const { ensureDirectKey } = await import("../src/index.js");
    await ensureDirectKey("sb-abc", env);

    await cleanupDirectSsh("sb-abc", env);
    expect(await hasDirectSshConfigBlock("sb-abc", env)).toBe(false);
    expect(await directKeyExists("sb-abc", env)).toBe(false);
    expect(await readFile(getKnownHostsPath(env), "utf8")).not.toContain("[eu.example.test]");
  });
});
