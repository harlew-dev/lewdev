import type { TerminalSession } from "@lewdev/core";

export const LEWDEV_SESSION_NAME = "lewdev";
export const SESSION_LOG_LINES = 2000;

/**
 * The session Open terminal reattaches to: the newest running PTY session named
 * "lewdev". Sessions started from "New shell session" get a numbered name, so
 * they are listed but do not hijack Open terminal.
 */
export function findReattachSession(sessions: TerminalSession[]): TerminalSession | undefined {
  return sessions
    .filter(
      (session) =>
        session.name === LEWDEV_SESSION_NAME && session.status === "running" && session.pty,
    )
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}

/**
 * The next free "lewdev-N" name for a new shell. The base "lewdev" counts as
 * one, so the first extra shell is "lewdev-2".
 */
export function nextShellSessionName(sessions: TerminalSession[]): string {
  let highest = 1;
  for (const session of sessions) {
    const match = /^lewdev(?:-(\d+))?$/.exec(session.name);
    if (!match) {
      continue;
    }
    const number = match[1] === undefined ? 1 : Number(match[1]);
    if (Number.isInteger(number) && number > highest) {
      highest = number;
    }
  }
  return `${LEWDEV_SESSION_NAME}-${highest + 1}`;
}

/** A session's command as one line; an empty argv is a login shell. */
export function sessionCommand(session: TerminalSession): string {
  return session.argv.length === 0 ? "login shell" : session.argv.join(" ");
}

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
// CSI, OSC and the shorter two-character escapes terminal programs emit.
const ANSI_ESCAPE = new RegExp(
  `${ESC}\\[[0-?]*[ -/]*[@-~]|${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)|${ESC}[@-_]`,
  "g",
);

function stripControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      result += character;
    }
  }
  return result;
}

/**
 * The last `maxLines` readable lines of a raw session log. The log is terminal
 * output, so colours and other escape sequences are stripped, and a carriage
 * return keeps only the final text written to that line.
 */
export function tailSessionLog(bytes: Uint8Array, maxLines: number = SESSION_LOG_LINES): string[] {
  if (bytes.length === 0 || maxLines <= 0) {
    return [];
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const readable = stripControlCharacters(text.replace(ANSI_ESCAPE, ""));
  const lines = readable
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.split("\r").pop() ?? "");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.slice(-maxLines);
}
