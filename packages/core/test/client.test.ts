import { describe, expect, test } from "bun:test";
import type {
  CallOptions,
  CreateOptions,
  ExposePortOptions,
  ExposeResult,
  HealthStatus,
  ListOptions,
} from "@aerol-ai/aerolvm-sdk";
import { Image } from "@aerol-ai/aerolvm-sdk";

import { type AerolSdk, LewdevApi, type SandboxInfo, type SdkSandbox } from "../src/index.js";

interface Call {
  method: string;
  args: unknown[];
}

const createdAt = "2026-11-25T10:00:00Z";

function sandbox(overrides: Partial<SdkSandbox> = {}): SdkSandbox {
  const base: Omit<SdkSandbox, "exposePort" | "unexposePort"> = {
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
    ...overrides,
  };
}

function fakeSdk(
  options: {
    create?: (options: CreateOptions) => SdkSandbox;
    list?: () => SdkSandbox[];
    get?: () => SdkSandbox;
    health?: HealthStatus;
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
      { port: 3000, url: "https://sb.example.com/3000", visibility: "token" },
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
