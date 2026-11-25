export interface ClipboardCommandResult {
  exitCode: number;
  stdout: string;
}

export interface ClipboardSpawnOptions {
  timeoutMs: number;
  stdin?: string;
}

export type ClipboardSpawn = (
  argv: string[],
  options: ClipboardSpawnOptions,
) => Promise<ClipboardCommandResult>;

export interface ReadClipboardOptions {
  spawn?: ClipboardSpawn;
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

export interface WriteClipboardOptions {
  spawn?: ClipboardSpawn;
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2000;

async function defaultSpawn(
  argv: string[],
  options: ClipboardSpawnOptions,
): Promise<ClipboardCommandResult> {
  const isWriter = options.stdin !== undefined;
  const child = Bun.spawn(argv, {
    stdin: isWriter ? new TextEncoder().encode(options.stdin ?? "") : "ignore",
    stdout: isWriter ? "ignore" : "pipe",
    stderr: "ignore",
  });

  const timer = setTimeout(() => {
    try {
      child.kill();
    } catch {
      // The process exited between the timer firing and the kill.
    }
  }, options.timeoutMs);

  try {
    if (isWriter || !child.stdout) {
      const exitCode = await child.exited;
      return { exitCode, stdout: "" };
    }
    const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    return { exitCode, stdout };
  } finally {
    clearTimeout(timer);
  }
}

function stripTrailingNewline(value: string): string {
  if (value.endsWith("\r\n")) {
    return value.slice(0, -2);
  }
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

/**
 * Reads text from the system clipboard. Commands are tried in order and tools
 * that are missing or fail are skipped. Returns null when no reader works;
 * an empty string means the clipboard is empty.
 */
export async function readClipboard(options: ReadClipboardOptions = {}): Promise<string | null> {
  const spawn = options.spawn ?? defaultSpawn;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const candidates: string[][] = [];
  if (env.WAYLAND_DISPLAY?.trim()) {
    candidates.push(["wl-paste", "--no-newline"]);
  }
  candidates.push(["xclip", "-selection", "clipboard", "-o"]);
  if (env.DISPLAY?.trim()) {
    candidates.push(["xsel", "--clipboard", "--output"]);
  }
  if (platform === "darwin") {
    candidates.push(["pbpaste"]);
  }

  for (const argv of candidates) {
    try {
      const result = await spawn(argv, { timeoutMs });
      if (result.exitCode === 0) {
        return stripTrailingNewline(result.stdout);
      }
    } catch {
      // Not installed, timed out, or refused to run: try the next reader.
    }
  }

  return null;
}

/**
 * Writes text to the system clipboard. Commands are tried in order and tools
 * that are missing or fail are skipped. Returns false when no writer works.
 */
export async function writeClipboard(
  text: string,
  options: WriteClipboardOptions = {},
): Promise<boolean> {
  const spawn = options.spawn ?? defaultSpawn;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const candidates: string[][] = [];
  if (env.WAYLAND_DISPLAY?.trim()) {
    candidates.push(["wl-copy"]);
  }
  candidates.push(["xclip", "-selection", "clipboard"]);
  if (env.DISPLAY?.trim()) {
    candidates.push(["xsel", "--clipboard", "--input"]);
  }
  if (platform === "darwin") {
    candidates.push(["pbcopy"]);
  }

  for (const argv of candidates) {
    try {
      const result = await spawn(argv, { timeoutMs, stdin: text });
      if (result.exitCode === 0) {
        return true;
      }
    } catch {
      // Not installed, timed out, or refused to run: try the next writer.
    }
  }

  return false;
}
