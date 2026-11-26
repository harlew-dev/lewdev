import { describe, expect, test } from "bun:test";

import { type AerolSdk, LewdevApi, runSshProxy, type SdkSandbox } from "../src/index.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Harness {
  api: LewdevApi;
  writes: string[];
  stdout: string[];
  stderr: string[];
  closed: boolean;
}

function harness(
  options: {
    banner?: string;
    code?: number;
    input?: AsyncIterable<Uint8Array>;
    openDelay?: number;
    exitDelay?: number;
  } = {},
): Harness {
  const writes: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  let closed = false;
  let open = false;

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
    execStream: (streamOptions: {
      onStdout?: (chunk: Uint8Array) => void;
      onStderr?: (chunk: Uint8Array) => void;
    }) => {
      let finish: (value: { code: number }) => void = () => {};
      const done = new Promise<{ code: number }>((resolve) => {
        finish = resolve;
      });
      const banner = options.banner ?? "SSH-2.0-OpenSSH_9.6\r\n";
      setTimeout(() => {
        open = true;
        streamOptions.onStdout?.(encoder.encode(banner));
      }, options.openDelay ?? 5);
      setTimeout(() => {
        finish({ code: options.code ?? 0 });
      }, options.exitDelay ?? 20);
      return {
        write: (data: Uint8Array | string) => {
          if (open) {
            writes.push(typeof data === "string" ? data : decoder.decode(data));
          }
        },
        resize: () => {},
        signal: () => {},
        close: () => {
          closed = true;
        },
        done,
      };
    },
  } as unknown as SdkSandbox;
  const sdk = { get: async () => sandbox } as unknown as AerolSdk;

  return {
    api: new LewdevApi(sdk),
    writes,
    stdout,
    stderr,
    get closed() {
      return closed;
    },
  };
}

async function* input(chunks: Array<{ text: string; wait: number }>): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    if (chunk.wait > 0) {
      await delay(chunk.wait);
    }
    yield encoder.encode(chunk.text);
  }
}

describe("ssh proxy", () => {
  test("buffers stdin until sshd's banner, then flushes it in order", async () => {
    const stdin = input([
      { text: "hello", wait: 0 },
      { text: "world", wait: 12 },
    ]);
    const testHarness = harness();

    const code = await runSshProxy(testHarness.api, "sb-abc", {
      stdin,
      stdout: { write: (chunk) => testHarness.stdout.push(decoder.decode(chunk)) },
      stderr: { write: (chunk) => testHarness.stderr.push(String(chunk)) },
    });

    expect(code).toBe(0);
    expect(testHarness.stdout.join("")).toContain("SSH-2.0-OpenSSH");
    expect(testHarness.writes).toEqual(["hello", "world"]);
    expect(testHarness.closed).toBe(true);
  });

  test("returns the remote exit code", async () => {
    const testHarness = harness({ code: 7 });
    const code = await runSshProxy(testHarness.api, "sb-abc", {
      stdin: input([]),
      stdout: { write: (chunk) => testHarness.stdout.push(decoder.decode(chunk)) },
      stderr: { write: (chunk) => testHarness.stderr.push(String(chunk)) },
    });
    expect(code).toBe(7);
    expect(testHarness.closed).toBe(true);
  });
});
