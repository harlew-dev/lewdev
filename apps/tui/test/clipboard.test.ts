import { describe, expect, test } from "bun:test";

import {
  type ClipboardCommandResult,
  type ClipboardSpawn,
  readClipboard,
  writeClipboard,
} from "../src/clipboard";

interface RecordedCall {
  argv: string[];
  timeoutMs: number;
  stdin?: string;
}

function fakeSpawn(
  handler: (argv: string[]) => ClipboardCommandResult | Promise<ClipboardCommandResult>,
): { spawn: ClipboardSpawn; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const spawn: ClipboardSpawn = async (argv, options) => {
    calls.push({ argv, timeoutMs: options.timeoutMs, stdin: options.stdin });
    return handler(argv);
  };
  return { spawn, calls };
}

const linuxEnv = { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" };

describe("readClipboard", () => {
  test("tries Wayland, then X11, then Xsel", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "wl-paste" || argv[0] === "xclip" || argv[0] === "xsel") {
        throw new Error("not installed");
      }
      throw new Error("unexpected command");
    });

    expect(await readClipboard({ spawn, env: linuxEnv, platform: "linux" })).toBeNull();
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-paste", "xclip", "xsel"]);
    expect(calls[0]?.argv).toEqual(["wl-paste", "--no-newline"]);
    expect(calls[1]?.argv).toEqual(["xclip", "-selection", "clipboard", "-o"]);
    expect(calls[2]?.argv).toEqual(["xsel", "--clipboard", "--output"]);
    expect(calls.every((call) => call.timeoutMs === 2000)).toBe(true);
  });

  test("returns the first successful reader and strips one trailing newline", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "wl-paste") {
        return { exitCode: 0, stdout: "from wayland\r\n" };
      }
      throw new Error("should not run");
    });

    expect(await readClipboard({ spawn, env: linuxEnv, platform: "linux" })).toBe("from wayland");
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-paste"]);
  });

  test("skips non-zero readers and keeps trying", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "wl-paste") {
        return { exitCode: 1, stdout: "ignored" };
      }
      if (argv[0] === "xclip") {
        return { exitCode: 0, stdout: "from xclip" };
      }
      throw new Error("should not run");
    });

    expect(await readClipboard({ spawn, env: linuxEnv, platform: "linux" })).toBe("from xclip");
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-paste", "xclip"]);
  });

  test("honours the environment gates for wl-paste and xsel", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "xclip") {
        return { exitCode: 0, stdout: "x11" };
      }
      throw new Error("unexpected command");
    });

    expect(await readClipboard({ spawn, env: {}, platform: "linux" })).toBe("x11");
    expect(calls.map((call) => call.argv[0])).toEqual(["xclip"]);
  });

  test("tries pbpaste on macOS", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "pbpaste") {
        return { exitCode: 0, stdout: "from mac" };
      }
      throw new Error("not installed");
    });

    expect(await readClipboard({ spawn, env: {}, platform: "darwin" })).toBe("from mac");
    expect(calls.map((call) => call.argv[0])).toEqual(["xclip", "pbpaste"]);
  });

  test("treats an empty successful clipboard as empty, not a failure", async () => {
    const { spawn } = fakeSpawn(() => ({ exitCode: 0, stdout: "\n" }));
    expect(await readClipboard({ spawn, env: linuxEnv, platform: "linux" })).toBe("");
  });

  test("uses the supplied timeout for every reader", async () => {
    const { spawn, calls } = fakeSpawn(() => {
      throw new Error("not installed");
    });
    await readClipboard({ spawn, env: linuxEnv, platform: "linux", timeoutMs: 50 });
    expect(calls.every((call) => call.timeoutMs === 50)).toBe(true);
  });
});

describe("writeClipboard", () => {
  test("tries Wayland, then X11, then Xsel with the text on stdin", async () => {
    const { spawn, calls } = fakeSpawn(() => {
      throw new Error("not installed");
    });

    expect(
      await writeClipboard("ssh -i key user@host", {
        spawn,
        env: linuxEnv,
        platform: "linux",
      }),
    ).toBe(false);
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-copy", "xclip", "xsel"]);
    expect(calls[0]?.argv).toEqual(["wl-copy"]);
    expect(calls[1]?.argv).toEqual(["xclip", "-selection", "clipboard"]);
    expect(calls[2]?.argv).toEqual(["xsel", "--clipboard", "--input"]);
    expect(calls.every((call) => call.stdin === "ssh -i key user@host")).toBe(true);
    expect(calls.every((call) => call.timeoutMs === 2000)).toBe(true);
  });

  test("stops at the first successful writer", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "wl-copy") {
        return { exitCode: 0, stdout: "" };
      }
      throw new Error("should not run");
    });

    expect(await writeClipboard("copied", { spawn, env: linuxEnv, platform: "linux" })).toBe(true);
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-copy"]);
  });

  test("skips a failing writer and continues", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "wl-copy") {
        return { exitCode: 1, stdout: "" };
      }
      if (argv[0] === "xclip") {
        return { exitCode: 0, stdout: "" };
      }
      throw new Error("should not run");
    });

    expect(await writeClipboard("copied", { spawn, env: linuxEnv, platform: "linux" })).toBe(true);
    expect(calls.map((call) => call.argv[0])).toEqual(["wl-copy", "xclip"]);
  });

  test("honours the environment gates and tries pbcopy on macOS", async () => {
    const { spawn, calls } = fakeSpawn((argv) => {
      if (argv[0] === "pbcopy") {
        return { exitCode: 0, stdout: "" };
      }
      throw new Error("not installed");
    });

    expect(await writeClipboard("copied", { spawn, env: {}, platform: "darwin" })).toBe(true);
    expect(calls.map((call) => call.argv[0])).toEqual(["xclip", "pbcopy"]);
  });

  test("uses the supplied timeout for writers", async () => {
    const { spawn, calls } = fakeSpawn(() => {
      throw new Error("not installed");
    });
    await writeClipboard("copied", {
      spawn,
      env: linuxEnv,
      platform: "linux",
      timeoutMs: 75,
    });
    expect(calls.every((call) => call.timeoutMs === 75)).toBe(true);
  });
});
