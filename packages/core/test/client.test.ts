import { describe, expect, test } from "bun:test";
import type {
  APIToken,
  AuditPage,
  CreateAPITokenOptions,
  CallOptions,
  CreateOptions,
  CreateSessionOptions,
  CreateSnapshotOptions,
  CustomDomain,
  CustomDomainDNSRecords,
  ExposePortOptions,
  ExposeResult,
  HealthStatus,
  IngressTarget,
  Lifecycle,
  ListOptions,
  ListSnapshotsOptions,
  RegisterSnapshotOptions,
  ResizeOptions,
  SandboxSnapshot,
  Session,
  SessionAttachHandle,
  SessionAttachOptions,
  SnapshotList,
  TeamQuota,
  WhoAmI,
} from "@aerol-ai/aerolvm-sdk";
import { Image } from "@aerol-ai/aerolvm-sdk";

import {
  type AerolSdk,
  LewdevApi,
  validateCreateApiToken,
  type SandboxInfo,
  type SdkSandbox,
  type SnapshotInfo,
} from "../src/index.js";

type SdkNetworkUsage = Awaited<ReturnType<SdkSandbox["getNetworkUsage"]>>;
type SdkNetworkLimits = Parameters<SdkSandbox["setNetworkLimits"]>[0];

interface Call {
  method: string;
  args: unknown[];
}

const createdAt = "2026-11-25T10:00:00Z";

function sandbox(overrides: Partial<SdkSandbox> = {}): SdkSandbox {
  const base: Omit<
    SdkSandbox,
    | "exposePort"
    | "unexposePort"
    | "exec"
    | "execStream"
    | "uploadFile"
    | "listFiles"
    | "getFileInfo"
    | "fileExists"
    | "uploadFileStream"
    | "uploadDir"
    | "downloadFile"
    | "downloadFileStream"
    | "deleteFile"
    | "makeDir"
    | "moveFile"
    | "copyFile"
    | "searchFiles"
    | "findInFiles"
    | "customDomains"
    | "getNetworkUsage"
    | "setNetworkLimits"
    | "audit"
  > = {
    id: "sb-0123456789abcdef",
    image: "ubuntu:24.04",
    status: "started",
    publicURL: "https://sb-0123456789abcdef.example.com",
    cpu: 2,
    memoryMB: 2048,
    diskGB: 10,
    osUser: "sandbox",
    createdAt,
    updatedAt: createdAt,
    lastActiveAt: createdAt,
    lifecycle: {},
  };

  return {
    ...base,
    exposePort: async (port: number, options?: ExposePortOptions): Promise<ExposeResult> => ({
      protocol: "http",
      url: `https://sb.example.com/${port}`,
      visibility: options?.visibility === "token" ? "token" : undefined,
    }),
    unexposePort: async () => {},
    exec: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMS: 0,
      timedOut: false,
      stdoutTruncated: false,
      stderrTruncated: false,
    }),
    uploadFile: async () => {},
    execStream: () => ({
      write: () => {},
      resize: () => {},
      signal: () => {},
      close: () => {},
      done: Promise.resolve({ code: 0 }),
    }),
    listFiles: async () => ({ entries: [], truncated: false }),
    getFileInfo: async () => ({
      name: "root",
      path: "/root",
      isDir: true,
      size: 0,
      mode: "drwxr-xr-x",
      permissions: "0755",
      owner: "root",
      group: "root",
      modTime: createdAt,
    }),
    fileExists: async () => false,
    uploadFileStream: async () => {},
    uploadDir: async () => {},
    downloadFile: async () => new Uint8Array(),
    downloadFileStream: async () =>
      new Response(new Uint8Array()).body as ReadableStream<Uint8Array>,
    deleteFile: async () => {},
    makeDir: async () => {},
    moveFile: async () => {},
    copyFile: async () => {},
    searchFiles: async () => [],
    findInFiles: async () => [],
    customDomains: {
      add: async () => [],
      remove: async () => {},
      list: async () => [],
      dns: async () => ({ records: [], target: { source: "unknown", ips: [] } }),
    },
    getNetworkUsage: async () => networkUsage(),
    setNetworkLimits: async () => networkUsage(),
    audit: async () => auditPage(),
    ...overrides,
  };
}

function networkUsage(overrides: Partial<SdkNetworkUsage> = {}): SdkNetworkUsage {
  return {
    sandboxID: "sb-0123456789abcdef",
    bytesIn: 0,
    bytesOut: 0,
    bytesInLimit: 0,
    bytesOutLimit: 0,
    quotaExceeded: false,
    ...overrides,
  };
}

function auditPage(overrides: Partial<AuditPage> = {}): AuditPage {
  return {
    events: [],
    coverage: { answered: [], missing: [], partial: false },
    ...overrides,
  };
}

function snapshot(overrides: Partial<SandboxSnapshot> = {}): SandboxSnapshot {
  return {
    name: "base",
    image: "ubuntu:24.04",
    sourceSandboxID: "sb-0123456789abcdef",
    createdAt,
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "ses-0123456789abcdef",
    name: "lewdev",
    argv: ["bash", "-l"],
    pty: true,
    status: "running",
    exitCode: 0,
    createdAt,
    startedAt: createdAt,
    recording: false,
    bytes: 0,
    attached: 0,
    ...overrides,
  };
}

function fakeSdk(
  options: {
    create?: (options: CreateOptions) => SdkSandbox;
    list?: () => SdkSandbox[];
    get?: () => SdkSandbox;
    resize?: (id: string, resizeOptions: ResizeOptions) => SdkSandbox;
    updateLifecycle?: (id: string, lifecycle: Lifecycle) => SdkSandbox;
    health?: HealthStatus;
    createSnapshot?: (
      id: string,
      name: string,
      snapshotOptions?: CreateSnapshotOptions,
    ) => SandboxSnapshot;
    registerSnapshot?: (snapshotOptions: RegisterSnapshotOptions) => SandboxSnapshot;
    getSnapshot?: () => SandboxSnapshot;
    listSnapshots?: (snapshotOptions?: ListSnapshotsOptions) => SnapshotList;
    deleteSnapshot?: (name: string) => void;
    whoami?: WhoAmI;
    getTeamQuota?: (team: string) => TeamQuota;
    apiTokens?: APIToken[];
    createSession?: (id: string, sessionOptions: CreateSessionOptions) => Session;
    listSessions?: (id: string) => Session[];
    getSession?: (id: string, sessionID: string) => Session;
    deleteSession?: (id: string, sessionID: string) => void;
    signalSession?: (id: string, sessionID: string, signal: string) => void;
    resizeSession?: (id: string, sessionID: string, cols: number, rows: number) => void;
    sessionLog?: (id: string, sessionID: string) => Uint8Array;
    attachSession?: (
      id: string,
      sessionID: string,
      attachOptions?: SessionAttachOptions,
    ) => SessionAttachHandle;
    listCustomDomains?: () => CustomDomain[];
    addCustomDomain?: (hostname: string, addOptions?: { port?: number }) => CustomDomain[];
    removeCustomDomain?: (hostname: string) => void;
    customDomainDNS?: () => CustomDomainDNSRecords;
    getNetworkUsage?: () => SdkNetworkUsage;
    setNetworkLimits?: (limitOptions: SdkNetworkLimits) => SdkNetworkUsage;
    audit?: (id: string, auditOptions?: unknown) => AuditPage;
    ingressDNS?: () => IngressTarget;
  } = {},
): { sdk: AerolSdk; calls: Call[] } {
  const calls: Call[] = [];

  const sdk: AerolSdk = {
    create: async (createOptions: CreateOptions): Promise<SdkSandbox> => {
      calls.push({ method: "create", args: [createOptions] });
      return options.create?.(createOptions) ?? sandbox();
    },
    list: async (_listOptions?: ListOptions): Promise<SdkSandbox[]> => {
      calls.push({ method: "list", args: [] });
      return options.list?.() ?? [];
    },
    get: async (id: string): Promise<SdkSandbox> => {
      calls.push({ method: "get", args: [id] });
      const base = options.get?.() ?? sandbox({ id });
      return {
        ...base,
        customDomains: {
          add: async (hostname: string, addOptions?: { port?: number }) => {
            calls.push({ method: "addCustomDomain", args: [id, hostname, addOptions] });
            return options.addCustomDomain?.(hostname, addOptions) ?? [];
          },
          remove: async (hostname: string) => {
            calls.push({ method: "removeCustomDomain", args: [id, hostname] });
            options.removeCustomDomain?.(hostname);
          },
          list: async () => {
            calls.push({ method: "listCustomDomains", args: [id] });
            return options.listCustomDomains?.() ?? [];
          },
          dns: async () => {
            calls.push({ method: "customDomainDNS", args: [id] });
            return (
              options.customDomainDNS?.() ?? { records: [], target: { source: "unknown", ips: [] } }
            );
          },
        },
        getNetworkUsage: async () => {
          calls.push({ method: "getNetworkUsage", args: [id] });
          return options.getNetworkUsage?.() ?? networkUsage({ sandboxID: id });
        },
        setNetworkLimits: async (limitOptions: SdkNetworkLimits) => {
          calls.push({ method: "setNetworkLimits", args: [id, limitOptions] });
          return options.setNetworkLimits?.(limitOptions) ?? networkUsage({ sandboxID: id });
        },
        audit: async (auditOptions?: unknown) => {
          calls.push({ method: "audit", args: [id, auditOptions] });
          return options.audit?.(id, auditOptions) ?? auditPage();
        },
      };
    },
    start: async (id: string): Promise<SdkSandbox> => {
      calls.push({ method: "start", args: [id] });
      return sandbox({ id, status: "started" });
    },
    stop: async (id: string): Promise<SdkSandbox> => {
      calls.push({ method: "stop", args: [id] });
      return sandbox({ id, status: "stopped" });
    },
    destroy: async (id: string): Promise<void> => {
      calls.push({ method: "destroy", args: [id] });
    },
    resize: async (id: string, resizeOptions: ResizeOptions): Promise<SdkSandbox> => {
      calls.push({ method: "resize", args: [id, resizeOptions] });
      return options.resize?.(id, resizeOptions) ?? sandbox({ id });
    },
    updateLifecycle: async (id: string, lifecycle: Lifecycle): Promise<SdkSandbox> => {
      calls.push({ method: "updateLifecycle", args: [id, lifecycle] });
      return options.updateLifecycle?.(id, lifecycle) ?? sandbox({ id, lifecycle });
    },
    health: async (_call?: CallOptions): Promise<HealthStatus> => {
      calls.push({ method: "health", args: [] });
      return (
        options.health ?? {
          status: "ok",
          sandboxes: 0,
          docker: "ok",
          caddy: "ok",
          sshGateway: "ok",
          version: "0.8.3",
        }
      );
    },
    dns: {
      target: async (): Promise<IngressTarget> => {
        calls.push({ method: "dnsTarget", args: [] });
        return options.ingressDNS?.() ?? { source: "unknown" };
      },
    },
    createSession: async (id: string, sessionOptions: CreateSessionOptions): Promise<Session> => {
      calls.push({ method: "createSession", args: [id, sessionOptions] });
      return options.createSession?.(id, sessionOptions) ?? session();
    },
    listSessions: async (id: string): Promise<Session[]> => {
      calls.push({ method: "listSessions", args: [id] });
      return options.listSessions?.(id) ?? [];
    },
    getSession: async (id: string, sessionID: string): Promise<Session> => {
      calls.push({ method: "getSession", args: [id, sessionID] });
      return options.getSession?.(id, sessionID) ?? session({ id: sessionID });
    },
    deleteSession: async (id: string, sessionID: string): Promise<void> => {
      calls.push({ method: "deleteSession", args: [id, sessionID] });
      options.deleteSession?.(id, sessionID);
    },
    signalSession: async (id: string, sessionID: string, signal: string): Promise<void> => {
      calls.push({ method: "signalSession", args: [id, sessionID, signal] });
      options.signalSession?.(id, sessionID, signal);
    },
    resizeSession: async (
      id: string,
      sessionID: string,
      cols: number,
      rows: number,
    ): Promise<void> => {
      calls.push({ method: "resizeSession", args: [id, sessionID, cols, rows] });
      options.resizeSession?.(id, sessionID, cols, rows);
    },
    sessionLog: async (id: string, sessionID: string): Promise<Uint8Array> => {
      calls.push({ method: "sessionLog", args: [id, sessionID] });
      return options.sessionLog?.(id, sessionID) ?? new Uint8Array();
    },
    attachSession: (
      id: string,
      sessionID: string,
      attachOptions?: SessionAttachOptions,
    ): SessionAttachHandle => {
      calls.push({ method: "attachSession", args: [id, sessionID, attachOptions] });
      return (
        options.attachSession?.(id, sessionID, attachOptions) ?? {
          write: () => {},
          resize: () => {},
          signal: () => {},
          close: () => {},
          done: Promise.resolve({ code: 0 }),
        }
      );
    },
    createSnapshot: async (
      id: string,
      name: string,
      snapshotOptions?: CreateSnapshotOptions,
    ): Promise<SandboxSnapshot> => {
      calls.push({ method: "createSnapshot", args: [id, name, snapshotOptions] });
      return options.createSnapshot?.(id, name, snapshotOptions) ?? snapshot({ name });
    },
    registerSnapshot: async (
      snapshotOptions: RegisterSnapshotOptions,
    ): Promise<SandboxSnapshot> => {
      calls.push({ method: "registerSnapshot", args: [snapshotOptions] });
      return (
        options.registerSnapshot?.(snapshotOptions) ?? snapshot({ name: snapshotOptions.name })
      );
    },
    getSnapshot: async (name: string): Promise<SandboxSnapshot> => {
      calls.push({ method: "getSnapshot", args: [name] });
      return options.getSnapshot?.() ?? snapshot({ name });
    },
    listSnapshots: async (snapshotOptions?: ListSnapshotsOptions): Promise<SnapshotList> => {
      calls.push({ method: "listSnapshots", args: [snapshotOptions] });
      return options.listSnapshots?.(snapshotOptions) ?? { snapshots: [], hasMore: false };
    },
    deleteSnapshot: async (name: string): Promise<void> => {
      calls.push({ method: "deleteSnapshot", args: [name] });
      options.deleteSnapshot?.(name);
    },
    whoami: async (): Promise<WhoAmI> => {
      calls.push({ method: "whoami", args: [] });
      return (
        options.whoami ?? {
          principal: { kind: "token", id: "tok_test" },
          role: "runner",
        }
      );
    },
    getTeamQuota: async (team: string): Promise<TeamQuota> => {
      calls.push({ method: "getTeamQuota", args: [team] });
      return (
        options.getTeamQuota?.(team) ?? {
          team,
          generation: 1,
          createdAt,
          updatedAt: createdAt,
        }
      );
    },
    tokens: {
      create: async (tokenOptions: CreateAPITokenOptions) => {
        calls.push({ method: "tokens.create", args: [tokenOptions] });
        return {
          id: "tok_new",
          name: tokenOptions.name,
          role: tokenOptions.role,
          team: tokenOptions.team,
          createdBy: "operator",
          createdAt,
          expiresAt: "2027-02-25T00:00:00Z",
          expired: false,
          token: "avm_secret_value",
        };
      },
      list: async () => {
        calls.push({ method: "tokens.list", args: [] });
        return { tokens: options.apiTokens ?? [] };
      },
      revoke: async (id: string) => {
        calls.push({ method: "tokens.revoke", args: [id] });
      },
    },
  };

  return { sdk, calls };
}

function expectSandbox(info: SandboxInfo): void {
  expect(info.id).toBe("sb-0123456789abcdef");
  expect(info.image).toBe("ubuntu:24.04");
  expect(info.status).toBe("started");
  expect(info.cpu).toBe(2);
  expect(info.memoryMB).toBe(2048);
  expect(info.diskGB).toBe(10);
  expect(info.createdAt).toBe(createdAt);
}

describe("LewdevApi", () => {
  test("lists sandboxes and maps exposed ports", async () => {
    const { sdk, calls } = fakeSdk({
      list: () => [
        sandbox({
          name: "dev",
          runtime: "docker",
          exposedPorts: [
            {
              port: 3000,
              publicURL: "https://sb.example.com/3000",
              visibility: "token",
            },
          ],
        }),
      ],
    });
    const api = new LewdevApi(sdk);

    const items = await api.listSandboxes();
    expect(calls.map((call) => call.method)).toEqual(["list"]);
    expect(items).toHaveLength(1);
    expectSandbox(items[0] as SandboxInfo);
    expect(items[0]?.name).toBe("dev");
    expect(items[0]?.runtime).toBe("docker");
    expect(items[0]?.exposedPorts).toEqual([
      { port: 3000, url: "https://sb.example.com/3000", visibility: "token", protocol: "http" },
    ]);
  });

  test("creates a sandbox with only the supplied options and returns the private key", async () => {
    const { sdk, calls } = fakeSdk({
      create: (createOptions) =>
        sandbox({
          name: createOptions.name,
          sshPrivateKey: "PRIVATE KEY",
        }),
    });
    const api = new LewdevApi(sdk);

    const created = await api.createSandbox({
      image: "  ubuntu:24.04  ",
      name: "  dev  ",
      cpu: 1.5,
    });

    expect(calls[0]).toEqual({
      method: "create",
      args: [{ image: "ubuntu:24.04", name: "dev", cpu: 1.5 }],
    });
    expect(created.privateKey).toBe("PRIVATE KEY");
    expect(created.sandbox.name).toBe("dev");
  });

  test("does not send optional fields that were left out", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.createSandbox({ image: "ubuntu:24.04" });
    expect(calls[0]?.args[0]).toEqual({ image: "ubuntu:24.04" });
    expect(calls[0]?.args[0]).not.toHaveProperty("name");
  });

  test("creates from Dockerfile contents with an Image builder", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.createSandbox({
      dockerfile: "FROM ubuntu:24.04\nRUN echo hi\n",
      name: "  build  ",
      cpu: 2,
    });

    const options = calls[0]?.args[0] as CreateOptions;
    expect(options.image).toBeInstanceOf(Image);
    expect((options.image as Image).dockerfile).toBe("FROM ubuntu:24.04\nRUN echo hi\n");
    expect(options.name).toBe("build");
    expect(options.cpu).toBe(2);
  });

  test("requires exactly one of image or Dockerfile", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await expect(api.createSandbox({})).rejects.toThrow("An image or Dockerfile is required.");
    await expect(
      api.createSandbox({ image: "ubuntu:24.04", dockerfile: "FROM scratch" }),
    ).rejects.toThrow("Provide either an image or a Dockerfile, not both.");
    expect(calls).toHaveLength(0);
  });

  test("maps details including the SSH public key", async () => {
    const { sdk } = fakeSdk({
      get: () => sandbox({ name: "dev", sshPublicKey: "ssh-ed25519 AAAA" }),
    });
    const api = new LewdevApi(sdk);
    const details = await api.getSandbox("sb-0123456789abcdef");
    expect(details.osUser).toBe("sandbox");
    expect(details.sshPublicKey).toBe("ssh-ed25519 AAAA");
  });

  test("maps runtime, reason, tags and lifecycle durations into details", async () => {
    const { sdk } = fakeSdk({
      get: () =>
        sandbox({
          runtime: "docker",
          status: "stopped",
          statusReason: "idle",
          exitCode: 137,
          tags: { env: "dev", owner: "acme" },
          lifecycle: {
            stopIfIdleFor: 30 * 60 * 1_000_000_000,
            destroyIfIdleFor: 24 * 60 * 60 * 1_000_000_000,
            serverless: true,
            restartOnFailure: true,
          },
        }),
    });
    const api = new LewdevApi(sdk);

    const details = await api.getSandbox("sb-0123456789abcdef");
    expect(details.runtime).toBe("docker");
    expect(details.statusReason).toBe("idle");
    expect(details.exitCode).toBe(137);
    expect(details.tags).toEqual({ env: "dev", owner: "acme" });
    expect(details.lifecycle).toEqual({
      stopIfIdleForMS: 30 * 60 * 1000,
      destroyIfIdleForMS: 24 * 60 * 60 * 1000,
      serverless: true,
      restartOnFailure: true,
    });
  });

  test("sends no lifecycle on create when none was chosen", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.createSandbox({ image: "ubuntu:24.04" });
    expect(calls[0]?.args[0]).not.toHaveProperty("lifecycle");
  });

  test("converts create lifecycle milliseconds to integer nanoseconds", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.createSandbox({
      image: "ubuntu:24.04",
      lifecycle: {
        stopIfIdleForMS: 30 * 60 * 1000,
        serverless: true,
        restartOnFailure: false,
      },
    });
    expect(calls[0]).toEqual({
      method: "create",
      args: [
        {
          image: "ubuntu:24.04",
          lifecycle: {
            stopIfIdleFor: 30 * 60 * 1_000_000_000,
            serverless: true,
            restartOnFailure: false,
          },
        },
      ],
    });
  });

  test("resizes with only the supplied dimensions and maps the result", async () => {
    const { sdk, calls } = fakeSdk({
      resize: (id, resizeOptions) =>
        sandbox({
          id,
          cpu: resizeOptions.cpu ?? 2,
          memoryMB: resizeOptions.memoryMB ?? 2048,
          diskGB: resizeOptions.diskGB ?? 10,
        }),
    });
    const api = new LewdevApi(sdk);

    const details = await api.resize("sb-abc", { cpu: 8, memoryMB: 16384 });
    expect(calls[0]).toEqual({
      method: "resize",
      args: ["sb-abc", { cpu: 8, memoryMB: 16384 }],
    });
    expect(details.cpu).toBe(8);
    expect(details.memoryMB).toBe(16384);
  });

  test("updates lifecycle with every timer converted to nanoseconds", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    const details = await api.updateLifecycle("sb-abc", {
      stopIfIdleForMS: 15 * 60 * 1000,
      destroyIfIdleForMS: 3 * 24 * 60 * 60 * 1000,
      stopAtAgeMS: 2 * 60 * 60 * 1000,
      serverless: true,
      restartOnFailure: true,
    });
    expect(calls[0]).toEqual({
      method: "updateLifecycle",
      args: [
        "sb-abc",
        {
          stopIfIdleFor: 15 * 60 * 1_000_000_000,
          destroyIfIdleFor: 3 * 24 * 60 * 60 * 1_000_000_000,
          stopAtAge: 2 * 60 * 60 * 1_000_000_000,
          serverless: true,
          restartOnFailure: true,
        },
      ],
    });
    expect(details.lifecycle.stopIfIdleForMS).toBe(15 * 60 * 1000);
  });

  test("rejects non-positive or fractional lifecycle durations before calling the server", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await expect(api.updateLifecycle("sb-abc", { stopIfIdleForMS: 0 })).rejects.toThrow(
      "positive whole milliseconds",
    );
    await expect(api.updateLifecycle("sb-abc", { stopIfIdleForMS: 1.5 })).rejects.toThrow(
      "positive whole milliseconds",
    );
    expect(calls).toHaveLength(0);
  });

  test("restarts by stopping before starting", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.restartSandbox("sb-abc");
    expect(calls.map((call) => call.method)).toEqual(["stop", "start"]);
    expect(calls.map((call) => call.args[0])).toEqual(["sb-abc", "sb-abc"]);
  });

  test("opens and closes ports through the sandbox resource", async () => {
    const calls: Call[] = [];
    const target = sandbox({
      exposePort: async (port, options) => {
        calls.push({ method: "exposePort", args: [port, options] });
        return { protocol: "http", url: `https://sb.example.com/${port}` };
      },
      unexposePort: async (port) => {
        calls.push({ method: "unexposePort", args: [port] });
      },
    });
    const { sdk } = fakeSdk({ get: () => target });
    const api = new LewdevApi(sdk);

    const opened = await api.openPort("sb-0123456789abcdef", 8080, "token");
    expect(calls[0]).toEqual({ method: "exposePort", args: [8080, { visibility: "token" }] });
    expect(opened).toEqual({
      port: 8080,
      url: "https://sb.example.com/8080",
      visibility: "token",
      protocol: "http",
    });

    await api.closePort("sb-0123456789abcdef", 8080);
    expect(calls[1]).toEqual({ method: "unexposePort", args: [8080] });
  });

  test("opens a TCP port with the host address and parses listed tcp URLs", async () => {
    const calls: Call[] = [];
    const target = sandbox({
      exposePort: async (port, options) => {
        calls.push({ method: "exposePort", args: [port, options] });
        return {
          protocol: "tcp",
          url: "tcp://eu.example.test:22042",
          host: "eu.example.test",
          hostPort: 22042,
        };
      },
    });
    const { sdk } = fakeSdk({
      get: () => target,
      list: () => [
        sandbox({
          exposedPorts: [
            { port: 22, publicURL: "tcp://eu.example.test:22042" },
            { port: 3000, publicURL: "https://sb.example.com/3000" },
          ],
        }),
      ],
    });
    const api = new LewdevApi(sdk);

    const opened = await api.openTcpPort("sb-0123456789abcdef", 22);
    expect(calls[0]).toEqual({ method: "exposePort", args: [22, { protocol: "tcp" }] });
    expect(opened).toEqual({
      port: 22,
      url: "tcp://eu.example.test:22042",
      protocol: "tcp",
      host: "eu.example.test",
      hostPort: 22042,
    });

    const listed = await api.listSandboxes();
    expect(listed[0]?.exposedPorts).toEqual([
      {
        port: 22,
        url: "tcp://eu.example.test:22042",
        protocol: "tcp",
        host: "eu.example.test",
        hostPort: 22042,
      },
      { port: 3000, url: "https://sb.example.com/3000", protocol: "http" },
    ]);
  });

  test("rejects a TCP request the server exposes over another protocol", async () => {
    const target = sandbox({
      exposePort: async () => ({ protocol: "http", url: "https://sb.example.com/25565" }),
    });
    const { sdk } = fakeSdk({ get: () => target });
    const api = new LewdevApi(sdk);

    await expect(api.openTcpPort("sb-0123456789abcdef", 25565)).rejects.toThrow(
      "The server exposed port 25565 as http, not TCP.",
    );
  });

  test("runs commands and uploads files through the sandbox resource", async () => {
    const calls: Call[] = [];
    const target = sandbox({
      exec: async (command) => {
        calls.push({ method: "exec", args: [command] });
        return {
          stdout: "ok",
          stderr: "",
          exitCode: 0,
          durationMS: 5,
          timedOut: false,
          stdoutTruncated: false,
          stderrTruncated: false,
        };
      },
      uploadFile: async (path, data, options) => {
        calls.push({ method: "uploadFile", args: [path, data, options] });
      },
    });
    const { sdk } = fakeSdk({ get: () => target });
    const api = new LewdevApi(sdk);

    await expect(api.exec("sb-abc", "true", { timeoutSeconds: 30 })).resolves.toEqual({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    await api.uploadFile("sb-abc", "/tmp/file", "contents", { mode: 0o600 });
    expect(calls).toEqual([
      { method: "exec", args: [{ command: "true", timeoutSeconds: 30 }] },
      { method: "uploadFile", args: ["/tmp/file", "contents", { mode: 0o600 }] },
    ]);
  });

  test("maps streams and folder listings from the sandbox resource", async () => {
    const writes: unknown[] = [];
    const target = sandbox({
      execStream: (options) => {
        options.onStdout?.(new Uint8Array([1, 2]));
        options.onStderr?.(new Uint8Array([3]));
        return {
          write: (data) => writes.push(data),
          resize: () => {},
          signal: () => {},
          close: () => {},
          done: Promise.resolve({ code: 0 }),
        };
      },
      listFiles: async (path, options) => ({
        entries: [
          {
            name: "root",
            path: `${path}/root`,
            isDir: true,
            size: 0,
            mode: "drwxr-xr-x",
            permissions: "0755",
            owner: "root",
            group: "root",
            modTime: createdAt,
          },
          {
            name: "link",
            path: `${path}/link`,
            isDir: false,
            size: 0,
            mode: "lrwxrwxrwx",
            permissions: "0777",
            owner: "root",
            group: "root",
            modTime: createdAt,
            symlinkTarget: "/root",
          },
        ],
        truncated: Boolean(options?.limit),
      }),
      getFileInfo: async (path) => ({
        name: "root",
        path,
        isDir: true,
        size: 0,
        mode: "drwxr-xr-x",
        permissions: "0755",
        owner: "root",
        group: "root",
        modTime: createdAt,
      }),
    });
    const { sdk } = fakeSdk({ get: () => target });
    const api = new LewdevApi(sdk);

    const stdout: number[] = [];
    const handle = await api.execStream("sb-abc", {
      command: "exec /usr/sbin/sshd -i",
      onStdout: (chunk) => stdout.push(...chunk),
    });
    handle.write("input");
    expect(writes).toEqual(["input"]);
    expect(stdout).toEqual([1, 2]);
    await expect(handle.done).resolves.toEqual({ code: 0 });

    const listing = await api.listFiles("sb-abc", "/root", { limit: 2000 });
    expect(listing.truncated).toBe(true);
    expect(listing.entries[1]).toEqual({
      name: "link",
      path: "/root/link",
      isDir: false,
      symlinkTarget: "/root",
      size: 0,
      modTime: createdAt,
      mode: "lrwxrwxrwx",
      permissions: "0777",
      owner: "root",
      group: "root",
    });
    await expect(api.getFileInfo("sb-abc", "/root")).resolves.toMatchObject({
      name: "root",
      isDir: true,
    });
  });

  test("wraps the remaining file verbs with lewdev-owned options", async () => {
    const calls: Call[] = [];
    const stream = new Response(new Uint8Array([1, 2, 3])).body as ReadableStream<Uint8Array>;
    const target = sandbox({
      fileExists: async (path) => {
        calls.push({ method: "fileExists", args: [path] });
        return path === "/root/there";
      },
      uploadFileStream: async (path, data, options) => {
        calls.push({ method: "uploadFileStream", args: [path, data, options] });
      },
      uploadDir: async (localDir, remoteDir) => {
        calls.push({ method: "uploadDir", args: [localDir, remoteDir] });
      },
      deleteFile: async (path, options) => {
        calls.push({ method: "deleteFile", args: [path, options] });
      },
      makeDir: async (path, options) => {
        calls.push({ method: "makeDir", args: [path, options] });
      },
      moveFile: async (source, destination, options) => {
        calls.push({ method: "moveFile", args: [source, destination, options] });
      },
      copyFile: async (source, destination, options) => {
        calls.push({ method: "copyFile", args: [source, destination, options] });
      },
      searchFiles: async (path, pattern) => {
        calls.push({ method: "searchFiles", args: [path, pattern] });
        return ["/root/notes.txt"];
      },
      findInFiles: async (path, text) => {
        calls.push({ method: "findInFiles", args: [path, text] });
        return [{ file: "/root/notes.txt", line: 3, content: "hello" }];
      },
      downloadFileStream: async (path, options) => {
        calls.push({ method: "downloadFileStream", args: [path, options] });
        return stream;
      },
    });
    const { sdk } = fakeSdk({ get: () => target });
    const api = new LewdevApi(sdk);

    await expect(api.fileExists("sb-abc", "/root/there")).resolves.toBe(true);
    await expect(api.fileExists("sb-abc", "/root/missing")).resolves.toBe(false);
    await api.uploadFileStream("sb-abc", "/root/a", stream);
    await api.uploadDir("sb-abc", "/tmp/project", "/root/project");
    await api.deleteFile("sb-abc", "/root/old", { recursive: true });
    await api.makeDir("sb-abc", "/root/new", { parents: true, mode: 0o750 });
    await api.moveFile("sb-abc", "/root/a", "/root/b", { overwrite: true });
    await api.copyFile("sb-abc", "/root/a", "/root/c", { recursive: true });
    await expect(api.searchFiles("sb-abc", "/root", "*.txt")).resolves.toEqual(["/root/notes.txt"]);
    await expect(api.findInFiles("sb-abc", "/root", "hello")).resolves.toEqual([
      { file: "/root/notes.txt", line: 3, content: "hello" },
    ]);
    await expect(api.downloadFileStream("sb-abc", "/root/a", { maxBytes: 10 })).resolves.toBe(
      stream,
    );

    expect(calls.map((call) => call.method)).toEqual([
      "fileExists",
      "fileExists",
      "uploadFileStream",
      "uploadDir",
      "deleteFile",
      "makeDir",
      "moveFile",
      "copyFile",
      "searchFiles",
      "findInFiles",
      "downloadFileStream",
    ]);
    expect(calls[2]?.args).toEqual(["/root/a", stream, {}]);
    expect(calls[4]?.args).toEqual(["/root/old", { recursive: true }]);
    expect(calls[5]?.args).toEqual(["/root/new", { parents: true, mode: 0o750 }]);
    expect(calls[6]?.args).toEqual(["/root/a", "/root/b", { overwrite: true }]);
    expect(calls[7]?.args).toEqual(["/root/a", "/root/c", { recursive: true }]);
    expect(calls[10]?.args).toEqual(["/root/a", { maxBytes: 10 }]);
  });

  test("rejects invalid ports before calling the server", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await expect(api.openPort("sb-abc", 0)).rejects.toThrow("Port must be an integer");
    await expect(api.openPort("sb-abc", 70_000)).rejects.toThrow("Port must be an integer");
    await expect(api.closePort("sb-abc", 1.5)).rejects.toThrow("Port must be an integer");
    expect(calls).toHaveLength(0);
  });

  test("forwards health checks", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    const health = await api.health();
    expect(health.version).toBe("0.8.3");
    expect(calls.map((call) => call.method)).toEqual(["health"]);
  });

  test("maps the raw /health runtime fields", async () => {
    const { sdk } = fakeSdk();
    const api = new LewdevApi(sdk, async () => ({
      status: "ok",
      docker: "ok",
      gvisor: "disabled",
      firecracker: "failed to start",
      version: "v0.7.0",
    }));

    expect(await api.getRuntimeAvailability()).toEqual({
      docker: { state: "available" },
      gvisor: { state: "off" },
      firecracker: { state: "unhealthy", detail: "failed to start" },
    });
  });

  test("reads missing runtime fields and a failed health request as unknown", async () => {
    const { sdk } = fakeSdk();
    const missing = new LewdevApi(sdk, async () => ({ status: "ok", docker: "ok" }));
    expect(await missing.getRuntimeAvailability()).toEqual({
      docker: { state: "available" },
      gvisor: { state: "unknown" },
      firecracker: { state: "unknown" },
    });

    const failed = new LewdevApi(sdk, async () => {
      throw new Error("offline");
    });
    expect(await failed.getRuntimeAvailability()).toEqual({
      docker: { state: "unknown" },
      gvisor: { state: "unknown" },
      firecracker: { state: "unknown" },
    });
  });

  test("passes the chosen runtime through on create", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.createSandbox({ image: "ubuntu:24.04", runtime: "firecracker" });
    expect(calls[0]).toEqual({
      method: "create",
      args: [{ image: "ubuntu:24.04", runtime: "firecracker" }],
    });
  });
});

describe("LewdevApi snapshots", () => {
  test("maps snapshot details and trims the requested name", async () => {
    const { sdk, calls } = fakeSdk({
      getSnapshot: () =>
        snapshot({
          name: "golden",
          image: "ghcr.io/acme/base:1",
          imageID: "sha256:abc",
          cpu: 2,
          gpu: 1,
          memoryMB: 4096,
          diskGB: 20,
          regionID: "eu-1",
          entrypoint: ["/bin/bash", "-lc"],
        }),
    });
    const api = new LewdevApi(sdk);

    const info = await api.getSnapshot("  golden  ");
    expect(calls[0]).toEqual({ method: "getSnapshot", args: ["golden"] });
    expect(info).toEqual({
      name: "golden",
      image: "ghcr.io/acme/base:1",
      imageID: "sha256:abc",
      sourceSandboxID: "sb-0123456789abcdef",
      createdAt,
      entrypoint: ["/bin/bash", "-lc"],
      regionID: "eu-1",
      cpu: 2,
      gpu: 1,
      memoryMB: 4096,
      diskGB: 20,
    });
  });

  test("omits hint fields the server did not return", async () => {
    const { sdk } = fakeSdk();
    const api = new LewdevApi(sdk);
    const info: SnapshotInfo = await api.getSnapshot("base");
    expect(info).not.toHaveProperty("imageID");
    expect(info).not.toHaveProperty("cpu");
    expect(info).not.toHaveProperty("memoryMB");
    expect(info).not.toHaveProperty("regionID");
  });

  test("loads every snapshot page and stops on an empty page", async () => {
    const { sdk, calls } = fakeSdk({
      listSnapshots: (options) => {
        if (options?.startingAfter === undefined) {
          return {
            snapshots: [snapshot({ name: "a" }), snapshot({ name: "b" })],
            hasMore: true,
          };
        }
        if (options.startingAfter === "b") {
          return { snapshots: [snapshot({ name: "c" })], hasMore: true };
        }
        return { snapshots: [], hasMore: true };
      },
    });
    const api = new LewdevApi(sdk);

    const items = await api.listSnapshots();
    expect(items.map((item) => item.name)).toEqual(["a", "b", "c"]);
    expect(calls).toEqual([
      { method: "listSnapshots", args: [undefined] },
      { method: "listSnapshots", args: [{ startingAfter: "b" }] },
      { method: "listSnapshots", args: [{ startingAfter: "c" }] },
    ]);
  });

  test("creates a snapshot with the trimmed name and pause choice", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    const info = await api.createSnapshot("sb-1", "  golden  ", { allowPause: false });
    expect(calls[0]).toEqual({
      method: "createSnapshot",
      args: ["sb-1", "golden", { allowPause: false }],
    });
    expect(info.name).toBe("golden");
  });

  test("registers from an image or Dockerfile with optional size hints", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.registerSnapshot({
      name: "  base  ",
      image: "  ubuntu:24.04  ",
      cpu: 2,
      memoryMB: 2048,
      diskGB: 10,
    });
    expect(calls[0]).toEqual({
      method: "registerSnapshot",
      args: [
        {
          name: "base",
          image: "ubuntu:24.04",
          cpu: 2,
          memoryMB: 2048,
          diskGB: 10,
        },
      ],
    });

    await api.registerSnapshot({
      name: "built",
      dockerfile: "  FROM scratch\n",
    });
    expect(calls[1]).toEqual({
      method: "registerSnapshot",
      args: [{ name: "built", dockerfileContent: "FROM scratch" }],
    });
  });

  test("requires exactly one image or Dockerfile when registering", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await expect(api.registerSnapshot({ name: "base" })).rejects.toThrow(
      "An image or Dockerfile is required.",
    );
    await expect(
      api.registerSnapshot({ name: "base", image: "ubuntu", dockerfile: "FROM scratch" }),
    ).rejects.toThrow("Provide either an image or a Dockerfile, not both.");
    expect(calls).toHaveLength(0);
  });

  test("rejects empty and reserved snapshot names before calling the server", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await expect(api.createSnapshot("sb-1", "   ")).rejects.toThrow("Snapshot name is required.");
    await expect(api.createSnapshot("sb-1", "aerolvm-snapshot/base")).rejects.toThrow("reserved");
    await expect(
      api.registerSnapshot({ name: "aerolvm-snapshot/x", image: "ubuntu" }),
    ).rejects.toThrow("reserved");
    await expect(api.getSnapshot("")).rejects.toThrow("Snapshot name is required.");
    await expect(api.deleteSnapshot("aerolvm-snapshot/x")).rejects.toThrow("reserved");
    expect(calls).toHaveLength(0);
  });

  test("deletes a snapshot by its trimmed name", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.deleteSnapshot("  golden  ");
    expect(calls[0]).toEqual({ method: "deleteSnapshot", args: ["golden"] });
  });
});

describe("LewdevApi sessions", () => {
  test("maps every session field", async () => {
    const { sdk, calls } = fakeSdk({
      listSessions: () => [
        session({
          id: "ses-abc",
          name: "lewdev-2",
          argv: ["sh", "-l"],
          workDir: "/root",
          pty: false,
          status: "exited",
          exitCode: 7,
          exitSignal: "TERM",
          exitedAt: createdAt,
          recording: true,
          bytes: 4096,
          attached: 2,
        }),
      ],
    });
    const api = new LewdevApi(sdk);

    const sessions = await api.listSessions("sb-abc");
    expect(calls[0]).toEqual({ method: "listSessions", args: ["sb-abc"] });
    expect(sessions).toEqual([
      {
        id: "ses-abc",
        name: "lewdev-2",
        argv: ["sh", "-l"],
        workDir: "/root",
        pty: false,
        status: "exited",
        exitCode: 7,
        exitSignal: "TERM",
        createdAt,
        startedAt: createdAt,
        exitedAt: createdAt,
        recording: true,
        bytes: 4096,
        attached: 2,
      },
    ]);
  });

  test("creates a session with only the supplied options", async () => {
    const { sdk, calls } = fakeSdk({
      createSession: (_id, sessionOptions) =>
        session({ name: sessionOptions.name ?? "", pty: sessionOptions.pty ?? false }),
    });
    const api = new LewdevApi(sdk);

    const created = await api.createSession("sb-abc", {
      name: "lewdev",
      pty: true,
      workDir: "/root",
      cols: 120,
      rows: 40,
    });

    expect(calls[0]).toEqual({
      method: "createSession",
      args: ["sb-abc", { name: "lewdev", pty: true, workDir: "/root", cols: 120, rows: 40 }],
    });
    expect(created.name).toBe("lewdev");
    expect(created.pty).toBe(true);
  });

  test("does not send optional session fields that were left out", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.createSession("sb-abc");
    expect(calls[0]).toEqual({ method: "createSession", args: ["sb-abc", {}] });
  });

  test("forwards get, delete, signal and resize session calls", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.getSession("sb-abc", "ses-1");
    await api.deleteSession("sb-abc", "ses-2");
    await api.signalSession("sb-abc", "ses-3", "TERM");
    await api.resizeSession("sb-abc", "ses-4", 100, 30);

    expect(calls).toEqual([
      { method: "getSession", args: ["sb-abc", "ses-1"] },
      { method: "deleteSession", args: ["sb-abc", "ses-2"] },
      { method: "signalSession", args: ["sb-abc", "ses-3", "TERM"] },
      { method: "resizeSession", args: ["sb-abc", "ses-4", 100, 30] },
    ]);
  });

  test("reads session log bytes", async () => {
    const output = new TextEncoder().encode("hello");
    const { sdk, calls } = fakeSdk({ sessionLog: () => output });
    const api = new LewdevApi(sdk);

    expect(await api.sessionLog("sb-abc", "ses-1")).toEqual(output);
    expect(calls[0]).toEqual({ method: "sessionLog", args: ["sb-abc", "ses-1"] });
  });

  test("forwards attach callbacks and handle methods", async () => {
    const written: Array<Uint8Array | string> = [];
    const resized: Array<[number, number]> = [];
    const signals: string[] = [];
    let closed = 0;
    let received: SessionAttachOptions | undefined;
    const { sdk, calls } = fakeSdk({
      attachSession: (_id, _sessionID, attachOptions) => {
        received = attachOptions;
        return {
          write: (data) => written.push(data),
          resize: (cols, rows) => resized.push([cols, rows]),
          signal: (name) => signals.push(name),
          close: () => {
            closed += 1;
          },
          done: Promise.resolve({ code: 3, signal: "TERM" }),
        };
      },
    });
    const api = new LewdevApi(sdk);
    const onStdout = () => {};
    const onStderr = () => {};

    const handle = api.attachSession("sb-abc", "ses-1", {
      onStdout,
      onStderr,
      cols: 80,
      rows: 24,
    });
    handle.write("ls\n");
    handle.resize(100, 30);
    handle.signal("INT");
    handle.close();

    expect(calls[0]).toEqual({
      method: "attachSession",
      args: ["sb-abc", "ses-1", { onStdout, onStderr, cols: 80, rows: 24 }],
    });
    expect(received?.onStdout).toBe(onStdout);
    expect(received?.onStderr).toBe(onStderr);
    expect(written).toEqual(["ls\n"]);
    expect(resized).toEqual([[100, 30]]);
    expect(signals).toEqual(["INT"]);
    expect(closed).toBe(1);
    expect(await handle.done).toEqual({ code: 3, signal: "TERM" });
  });
});

describe("LewdevApi account limits", () => {
  test("maps the caller's team and expiry", async () => {
    const { sdk, calls } = fakeSdk({
      whoami: {
        principal: { kind: "token", id: "tok_test" },
        role: "runner",
        team: "acme",
        expiresAt: "2026-12-01T00:00:00Z",
      },
    });
    const api = new LewdevApi(sdk);

    expect(await api.whoami()).toEqual({
      role: "runner",
      team: "acme",
      expiresAt: "2026-12-01T00:00:00Z",
      principalKind: "token",
      principalId: "tok_test",
    });
    expect(calls[0]).toEqual({ method: "whoami", args: [] });
  });

  test("maps a team quota's limits and usage", async () => {
    const { sdk, calls } = fakeSdk({
      getTeamQuota: (team) => ({
        team,
        maxSandboxes: 10,
        maxCPU: 8,
        maxMemoryMB: 16384,
        generation: 3,
        createdAt,
        updatedAt: createdAt,
        usage: { sandboxes: 3, cpu: 3, memoryMB: 3072 },
      }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.getTeamQuota("acme")).toEqual({
      team: "acme",
      maxSandboxes: 10,
      maxCPU: 8,
      maxMemoryMB: 16384,
      usage: { sandboxes: 3, cpu: 3, memoryMB: 3072 },
    });
    expect(calls[0]).toEqual({ method: "getTeamQuota", args: ["acme"] });
  });
});

function customDomain(overrides: Partial<CustomDomain> = {}): CustomDomain {
  return {
    hostname: "api.example.com",
    status: "pending_dns",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("LewdevApi custom domains", () => {
  test("lists domains with status, error and target port", async () => {
    const { sdk, calls } = fakeSdk({
      listCustomDomains: () => [
        customDomain({ targetPort: 8080 }),
        customDomain({ hostname: "www.example.com", status: "failed", lastError: "ACME failed" }),
      ],
    });
    const api = new LewdevApi(sdk);

    expect(await api.listCustomDomains("sb-abc")).toEqual([
      {
        hostname: "api.example.com",
        status: "pending_dns",
        createdAt,
        updatedAt: createdAt,
        targetPort: 8080,
      },
      {
        hostname: "www.example.com",
        status: "failed",
        lastError: "ACME failed",
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "listCustomDomains", args: ["sb-abc"] },
    ]);
  });

  test("adds a trimmed hostname with and without a port", async () => {
    const { sdk, calls } = fakeSdk({
      addCustomDomain: (hostname, addOptions) => [
        customDomain({ hostname, targetPort: addOptions?.port }),
      ],
    });
    const api = new LewdevApi(sdk);

    const withPort = await api.addCustomDomain("sb-abc", "  api.example.com ", { port: 8080 });
    const withoutPort = await api.addCustomDomain("sb-abc", "www.example.com");

    expect(withPort).toEqual([
      {
        hostname: "api.example.com",
        status: "pending_dns",
        createdAt,
        updatedAt: createdAt,
        targetPort: 8080,
      },
    ]);
    expect(withoutPort[0]?.targetPort).toBeUndefined();
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "addCustomDomain", args: ["sb-abc", "api.example.com", { port: 8080 }] },
      { method: "get", args: ["sb-abc"] },
      { method: "addCustomDomain", args: ["sb-abc", "www.example.com", undefined] },
    ]);
  });

  test("rejects an empty hostname or invalid port before calling the server", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await expect(api.addCustomDomain("sb-abc", "   ")).rejects.toThrow("Hostname is required.");
    await expect(api.addCustomDomain("sb-abc", "api.example.com", { port: 0 })).rejects.toThrow(
      "Port must be an integer from 1 to 65535",
    );
    expect(calls).toEqual([]);
  });

  test("removes a trimmed hostname", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.removeCustomDomain("sb-abc", " api.example.com ");

    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "removeCustomDomain", args: ["sb-abc", "api.example.com"] },
    ]);
  });

  test("maps the DNS records and ingress target", async () => {
    const { sdk, calls } = fakeSdk({
      customDomainDNS: () => ({
        records: [
          {
            hostname: "api.example.com",
            type: "CNAME",
            name: "api",
            value: "ingress.example.net",
            notes: "DNS only",
          },
        ],
        target: { hostname: "ingress.example.net", source: "hostname" },
      }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.customDomainDNS("sb-abc")).toEqual({
      records: [
        {
          hostname: "api.example.com",
          type: "CNAME",
          name: "api",
          value: "ingress.example.net",
          notes: "DNS only",
        },
      ],
      target: { hostname: "ingress.example.net", ips: [], source: "hostname" },
    });
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "customDomainDNS", args: ["sb-abc"] },
    ]);
  });

  test("maps the cluster ingress target", async () => {
    const { sdk, calls } = fakeSdk({
      ingressDNS: () => ({ hostname: "ingress.example.net", source: "hostname" }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.getIngressTarget()).toEqual({
      hostname: "ingress.example.net",
      ips: [],
      source: "hostname",
    });
    expect(calls).toEqual([{ method: "dnsTarget", args: [] }]);
  });
});

describe("LewdevApi network usage", () => {
  test("maps counters, limits and the optional sample times", async () => {
    const { sdk, calls } = fakeSdk({
      getNetworkUsage: () =>
        networkUsage({
          sandboxID: "sb-abc",
          bytesIn: 1024,
          bytesOut: 2048,
          bytesInLimit: 4096,
          quotaExceeded: true,
          quotaExceededAt: "2026-11-27T10:00:00Z",
          lastSampledAt: "2026-11-27T10:01:00Z",
        }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.getNetworkUsage("sb-abc")).toEqual({
      bytesIn: 1024,
      bytesOut: 2048,
      bytesInLimit: 4096,
      bytesOutLimit: 0,
      quotaExceeded: true,
      quotaExceededAt: "2026-11-27T10:00:00Z",
      lastSampledAt: "2026-11-27T10:01:00Z",
    });
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "getNetworkUsage", args: ["sb-abc"] },
    ]);
  });

  test("sets both limits with the SDK's field names", async () => {
    const { sdk, calls } = fakeSdk({
      setNetworkLimits: (limitOptions) =>
        networkUsage({
          bytesInLimit: limitOptions.networkBytesInLimit ?? 0,
          bytesOutLimit: limitOptions.networkBytesOutLimit ?? 0,
        }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.setNetworkLimits("sb-abc", { bytesInLimit: 1024, bytesOutLimit: 0 })).toEqual({
      bytesIn: 0,
      bytesOut: 0,
      bytesInLimit: 1024,
      bytesOutLimit: 0,
      quotaExceeded: false,
    });
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      {
        method: "setNetworkLimits",
        args: ["sb-abc", { networkBytesInLimit: 1024, networkBytesOutLimit: 0 }],
      },
    ]);
  });

  test("leaves omitted limits out of the request", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.setNetworkLimits("sb-abc", { bytesOutLimit: 2048 });

    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "setNetworkLimits", args: ["sb-abc", { networkBytesOutLimit: 2048 }] },
    ]);
  });

  test("rejects negative and fractional limits before calling the server", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await expect(api.setNetworkLimits("sb-abc", { bytesInLimit: -1 })).rejects.toThrow(
      "Inbound limit must be a whole number of bytes",
    );
    await expect(api.setNetworkLimits("sb-abc", { bytesOutLimit: 1.5 })).rejects.toThrow(
      "Outbound limit must be a whole number of bytes",
    );
    expect(calls).toEqual([]);
  });
});

describe("LewdevApi audit log", () => {
  test("maps events, coverage, gaps and the next cursor", async () => {
    const { sdk, calls } = fakeSdk({
      audit: () =>
        auditPage({
          events: [
            {
              time: "2026-11-27T10:00:00Z",
              kind: "egress",
              result: "failure",
              reason: "host_not_allowed",
              destination: "example.com:443",
              network: "tcp",
              actor: "system:lifecycle",
              ref: "ref-1",
              eventID: "evt-1",
              incarnationID: "inc-1",
            },
            { time: "2026-11-27T10:01:00Z", result: "success", dropped: 2 },
          ],
          coverage: { answered: ["node-a"], missing: ["node-b"], partial: true },
          nextCursor: "cursor-2",
        }),
    });
    const api = new LewdevApi(sdk);

    expect(await api.getAuditLog("sb-abc")).toEqual({
      events: [
        {
          time: "2026-11-27T10:00:00Z",
          kind: "egress",
          result: "failure",
          reason: "host_not_allowed",
          destination: "example.com:443",
          network: "tcp",
          actor: "system:lifecycle",
          ref: "ref-1",
          eventID: "evt-1",
          incarnationID: "inc-1",
        },
        { time: "2026-11-27T10:01:00Z", result: "success", dropped: 2 },
      ],
      coverage: { answered: ["node-a"], missing: ["node-b"], partial: true },
      nextCursor: "cursor-2",
    });
    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      { method: "audit", args: ["sb-abc", {}] },
    ]);
  });

  test("forwards kind, limit, cursor, incarnation and caller filters", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);

    await api.getAuditLog("sb-abc", {
      kind: "egress",
      limit: 50,
      cursor: "cursor-2",
      incarnationID: "inc-1",
      caller: "system:*",
    });

    expect(calls).toEqual([
      { method: "get", args: ["sb-abc"] },
      {
        method: "audit",
        args: [
          "sb-abc",
          {
            kind: "egress",
            limit: 50,
            cursor: "cursor-2",
            incarnationID: "inc-1",
            caller: "system:*",
          },
        ],
      },
    ]);
  });
});

describe("API tokens", () => {
  const token = (id: string, created: string): APIToken => ({
    id,
    name: id,
    role: "runner",
    team: "acme",
    createdBy: "operator",
    createdAt: created,
    expiresAt: "2027-01-01T00:00:00Z",
    expired: false,
  });

  test("lists tokens newest first without secrets", async () => {
    const { sdk } = fakeSdk({
      apiTokens: [
        token("tok_old", "2026-01-01T00:00:00Z"),
        token("tok_new", "2026-06-01T00:00:00Z"),
      ],
    });
    const listed = await new LewdevApi(sdk).listApiTokens();
    expect(listed.map((entry) => entry.id)).toEqual(["tok_new", "tok_old"]);
    expect(JSON.stringify(listed)).not.toContain("avm_");
  });

  test("returns the secret separately from the token record", async () => {
    const { sdk, calls } = fakeSdk();
    const created = await new LewdevApi(sdk).createApiToken({
      name: " ci-deploy ",
      role: "runner",
      team: "acme",
      expiresIn: "90d",
    });
    expect(created.secret).toBe("avm_secret_value");
    expect(JSON.stringify(created.token)).not.toContain("avm_secret_value");
    expect(calls[0]).toEqual({
      method: "tokens.create",
      args: [{ name: "ci-deploy", role: "runner", team: "acme", expiresIn: "90d" }],
    });
  });

  test("validates create requests before calling the server", () => {
    const valid = { name: "ci", role: "runner" as const, team: "acme", expiresIn: "720h" };
    expect(() => validateCreateApiToken(valid)).not.toThrow();
    expect(() => validateCreateApiToken({ ...valid, name: "has space" })).toThrow();
    expect(() => validateCreateApiToken({ ...valid, name: "x".repeat(65) })).toThrow();
    expect(() => validateCreateApiToken({ ...valid, team: " " })).toThrow();
    expect(() => validateCreateApiToken({ ...valid, role: "admin" })).toThrow(/team "\*"/);
    expect(() => validateCreateApiToken({ ...valid, role: "admin", team: "*" })).not.toThrow();
    expect(() => validateCreateApiToken({ ...valid, expiresIn: "forever" })).toThrow();
    expect(() => validateCreateApiToken({ ...valid, expiresIn: "1h30m" })).not.toThrow();
  });

  test("revokes by id and rejects ids that are not token ids", async () => {
    const { sdk, calls } = fakeSdk();
    const api = new LewdevApi(sdk);
    await api.revokeApiToken(" tok_abc ");
    expect(calls[0]).toEqual({ method: "tokens.revoke", args: ["tok_abc"] });
    await expect(api.revokeApiToken("../sandboxes")).rejects.toThrow();
  });
});
