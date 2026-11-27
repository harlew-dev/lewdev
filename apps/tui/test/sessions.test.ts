import { describe, expect, test } from "bun:test";
import type { TerminalSession } from "@lewdev/core";

import {
  findReattachSession,
  nextShellSessionName,
  sessionCommand,
  tailSessionLog,
} from "../src/sessions";

function session(overrides: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: "ses-1",
    name: "lewdev",
    argv: ["bash", "-l"],
    pty: true,
    status: "running",
    exitCode: 0,
    createdAt: "2026-11-27T10:00:00Z",
    startedAt: "2026-11-27T10:00:00Z",
    recording: false,
    bytes: 0,
    attached: 0,
    ...overrides,
  };
}

describe("terminal session helpers", () => {
  test("reattaches to the newest running lewdev PTY session", () => {
    const sessions = [
      session({ id: "old", startedAt: "2026-11-27T09:00:00Z" }),
      session({ id: "new", startedAt: "2026-11-27T11:00:00Z" }),
      session({ id: "ended", status: "exited" }),
      session({ id: "other", name: "lewdev-2" }),
      session({ id: "no-pty", pty: false }),
    ];

    expect(findReattachSession(sessions)?.id).toBe("new");
    expect(findReattachSession([])).toBeUndefined();
    expect(
      findReattachSession(sessions.filter((entry) => entry.id !== "old" && entry.id !== "new")),
    ).toBeUndefined();
  });

  test("numbers new shells after the highest lewdev name", () => {
    expect(nextShellSessionName([])).toBe("lewdev-2");
    expect(nextShellSessionName([session({ name: "lewdev" })])).toBe("lewdev-2");
    expect(nextShellSessionName([session({ name: "lewdev" }), session({ name: "lewdev-2" })])).toBe(
      "lewdev-3",
    );
    expect(
      nextShellSessionName([
        session({ name: "lewdev" }),
        session({ name: "lewdev-2" }),
        session({ name: "lewdev-4" }),
        session({ name: "other" }),
      ]),
    ).toBe("lewdev-5");
  });

  test("shows a login shell when argv is empty", () => {
    expect(sessionCommand(session({ argv: [] }))).toBe("login shell");
    expect(sessionCommand(session({ argv: ["sleep", "60"] }))).toBe("sleep 60");
  });

  test("tails readable lines and strips terminal control sequences", () => {
    const bytes = new TextEncoder().encode(
      "old\n\u001b[31mred\u001b[0m\nprogress 1\rprogress 2\n\u001b]0;title\u0007done\n",
    );
    const lines = tailSessionLog(bytes, 3);

    expect(lines).toEqual(["red", "progress 2", "done"]);
  });

  test("returns no lines for empty or invalid limits", () => {
    expect(tailSessionLog(new Uint8Array(), 10)).toEqual([]);
    expect(tailSessionLog(new TextEncoder().encode("hi"), 0)).toEqual([]);
  });
});
