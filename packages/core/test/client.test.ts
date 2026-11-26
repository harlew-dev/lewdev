import { describe, expect, test } from "bun:test";
import type {
  CallOptions,
  CreateOptions,
  CreateSnapshotOptions,
  ExposePortOptions,
  ExposeResult,
  HealthStatus,
  ListOptions,
  ListSnapshotsOptions,
  RegisterSnapshotOptions,
  SandboxSnapshot,
  SnapshotList,
  TeamQuota,
  WhoAmI,
} from "@aerol-ai/aerolvm-sdk";
import { Image } from "@aerol-ai/aerolvm-sdk";

import {
  type AerolSdk,
  LewdevApi,
  type SandboxInfo,
  type SdkSandbox,
  type SnapshotInfo,
} from "../src/index.js";

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

function fakeSdk(
  options: {
    create?: (options: CreateOptions) => SdkSandbox;
    list?: () => SdkSandbox[];
    get?: () => SdkSandbox;
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
      return options.get?.() ?? sandbox({ id });
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
    });
    await expect(api.getFileInfo("sb-abc", "/root")).resolves.toMatchObject({
      name: "root",
      isDir: true,
    });
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
