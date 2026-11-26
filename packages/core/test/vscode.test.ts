import { describe, expect, test } from "bun:test";

import { vscodeLaunchCommand } from "../src/vscode.js";

describe("vscodeLaunchCommand", () => {
  test("uses the code CLI with the direct-SSH alias when it is on PATH", () => {
    expect(vscodeLaunchCommand("sb-1", "/root/app", "linux", "/usr/bin/code")).toEqual({
      command: "/usr/bin/code",
      args: ["--remote", "ssh-remote+lewdev-sb-1", "/root/app"],
    });
  });

  test("falls back to the URL handler on Linux and macOS", () => {
    expect(vscodeLaunchCommand("sb-1", "/root", "linux", null).command).toBe("xdg-open");
    const mac = vscodeLaunchCommand("sb-1", "/root", "darwin", null);
    expect(mac.command).toBe("open");
    expect(mac.args[0]).toStartWith("vscode://vscode-remote/ssh-remote+lewdev-sb-1");
  });

  test("always goes through start on Windows, even when code is found", () => {
    const launch = vscodeLaunchCommand("sb-1", "/root", "win32", "C:/code.cmd");
    expect(launch.command).toBe("cmd");
    expect(launch.args.slice(0, 4)).toEqual(["/d", "/c", "start", ""]);
  });
});
