import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

import { LewdevApi, type SandboxInfo } from "./client.js";
import { loadConfig, type LewdevConfig } from "./config.js";
import {
  cleanupDirectSsh,
  ensureSshdRunning,
  getDirectSshAlias,
  getSshConfigPath,
  hasSshInclude,
  readDirectSshConfigBlock,
} from "./direct-ssh.js";
import { describeError } from "./errors.js";
import { deletePrivateKey, getKeyPath, privateKeyExists } from "./keys.js";
import { resolveRemotePath } from "./remote-path.js";
import { resolveSandbox } from "./sandbox-resolve.js";
import { buildSshArgv, ensureKnownHostsFile, getKnownHostsPath, sshHostFromApiUrl } from "./ssh.js";
import { openInVscode } from "./vscode.js";

const NOT_CONFIGURED = "lewdev is not configured. Run lewdev and connect to a server first.";
const SSH_NOT_SET_UP = 'SSH is not set up for this sandbox. Choose "Set up SSH" in the TUI first.';

const SANDBOX_COMMANDS = ["ls", "start", "stop", "delete", "ssh", "code", "exec"] as const;

export type SandboxCommand = (typeof SANDBOX_COMMANDS)[number];

export interface CliOutput {
  stdout: { write(chunk: string | Uint8Array): unknown };
  stderr: { write(chunk: string | Uint8Array): unknown };
}

const defaultIo: CliOutput = { stdout: process.stdout, stderr: process.stderr };

export function isSandboxCommand(value: string | undefined): value is SandboxCommand {
  return value !== undefined && (SANDBOX_COMMANDS as readonly string[]).includes(value);
}

/**
 * Runs one scriptable sandbox subcommand and returns the process exit code.
 * Usage and server errors are printed to stderr; stdout stays data-only.
 */
/**
 * Pulls `--profile <name>` or `--profile=<name>` out of the arguments. Anything
 * after `--` belongs to the remote command and is left alone.
 */
export function extractProfileFlag(args: readonly string[]): {
  args: string[];
  profile?: string;
} {
  const rest: string[] = [];
  let profile: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") {
      rest.push(...args.slice(index));
      break;
    }
    if (arg === "--profile") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("--profile needs a profile name.");
      }
      profile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length);
      if (!profile) {
        throw new Error("--profile needs a profile name.");
      }
      continue;
    }
    rest.push(arg);
  }
  return profile === undefined ? { args: rest } : { args: rest, profile };
}

let selectedProfile: string | undefined;

export async function runSandboxCli(args: string[], io: CliOutput = defaultIo): Promise<number> {
  try {
    const parsed = extractProfileFlag(args);
    selectedProfile = parsed.profile;
    return await dispatch(parsed.args, io);
  } catch (error) {
    io.stderr.write(`${describeError(error)}\n`);
    return 1;
  }
}

async function dispatch(args: string[], io: CliOutput): Promise<number> {
  const [command, ...rest] = args;
  switch (command) {
    case "ls":
      return runList(rest, io);
    case "start":
      return runStart(rest, io);
    case "stop":
      return runStop(rest, io);
    case "delete":
      return runDelete(rest, io);
    case "ssh":
      return runSsh(rest, io);
    case "code":
      return runCode(rest, io);
    case "exec":
      return runExec(rest, io);
    default:
      io.stderr.write(`Unknown option: ${command ?? ""}\n`);
      io.stderr.write("Run `lewdev --help` for usage.\n");
      return 1;
  }
}

interface CliContext {
  api: LewdevApi;
  config: LewdevConfig;
}

async function requireApi(io: CliOutput): Promise<CliContext | null> {
  const loaded = await loadConfig(
    process.env,
    selectedProfile === undefined ? {} : { profile: selectedProfile },
  );
  if (!loaded.config) {
    io.stderr.write(`${NOT_CONFIGURED}\n`);
    return null;
  }
  return { api: LewdevApi.fromConfig(loaded.config), config: loaded.config };
}

function sandboxLabel(sandbox: { id: string; name?: string }): string {
  return sandbox.name && sandbox.name.length > 0 ? sandbox.name : sandbox.id;
}

function expectOneArgument(args: string[], usage: string): string {
  const value = args[0];
  if (args.length !== 1 || value === undefined || value.startsWith("-")) {
    throw new Error(`Usage: ${usage}`);
  }
  return value;
}

async function resolveTarget(
  api: LewdevApi,
  query: string,
): Promise<{ id: string; label: string }> {
  const sandbox = resolveSandbox(await api.listSandboxes(), query);
  return { id: sandbox.id, label: sandboxLabel(sandbox) };
}

function displayStatus(status: string): string {
  switch (status) {
    case "started":
      return "running";
    case "awaiting_runtime":
      return "awaiting";
    default:
      return status;
  }
}

function formatCreated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Renders the aligned `lewdev ls` table. */
export function formatSandboxTable(sandboxes: readonly SandboxInfo[]): string {
  const headers = ["NAME", "ID", "STATUS", "RUNTIME", "IMAGE", "CREATED"];
  const rows = sandboxes.map((sandbox) => [
    sandbox.name?.trim() || "-",
    sandbox.id,
    displayStatus(sandbox.status),
    sandbox.runtime || "default",
    sandbox.image,
    formatCreated(sandbox.createdAt),
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)),
  );
  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell, index) =>
          index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? cell.length),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

async function runList(args: string[], io: CliOutput): Promise<number> {
  let json = false;
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}\nUsage: lewdev ls [--json]`);
  }

  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const sandboxes = await context.api.listSandboxes();
  if (json) {
    io.stdout.write(`${JSON.stringify(sandboxes, null, 2)}\n`);
    return 0;
  }
  if (sandboxes.length === 0) {
    io.stdout.write("No sandboxes.\n");
    return 0;
  }
  io.stdout.write(`${formatSandboxTable(sandboxes)}\n`);
  return 0;
}

async function runStart(args: string[], io: CliOutput): Promise<number> {
  const query = expectOneArgument(args, "lewdev start <sandbox>");
  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);
  await context.api.startSandbox(target.id);
  io.stdout.write(`Started ${target.label}.\n`);
  return 0;
}

async function runStop(args: string[], io: CliOutput): Promise<number> {
  const query = expectOneArgument(args, "lewdev stop <sandbox>");
  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);
  await context.api.stopSandbox(target.id);
  io.stdout.write(`Stopped ${target.label}.\n`);
  return 0;
}

async function confirmDelete(
  target: { label: string; id: string },
  io: CliOutput,
): Promise<boolean> {
  io.stderr.write(`Delete ${target.label} (${target.id})? [y/N] `);
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await readline.question("");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

async function runDelete(args: string[], io: CliOutput): Promise<number> {
  const confirmed = args.includes("--yes");
  const positional = args.filter((arg) => arg !== "--yes");
  const query = expectOneArgument(positional, "lewdev delete <sandbox> [--yes]");

  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);

  if (!confirmed) {
    if (process.stdin.isTTY !== true || process.stderr.isTTY !== true) {
      io.stderr.write(
        `Refusing to delete ${target.label} without confirmation. Re-run with --yes.\n`,
      );
      return 1;
    }
    if (!(await confirmDelete(target, io))) {
      io.stdout.write("Cancelled.\n");
      return 1;
    }
  }

  await context.api.destroySandbox(target.id);
  const warnings: string[] = [];
  try {
    await deletePrivateKey(target.id);
  } catch (error) {
    warnings.push(`its gateway key could not be deleted: ${describeError(error)}`);
  }
  try {
    await cleanupDirectSsh(target.id);
  } catch (error) {
    warnings.push(`its direct SSH data could not be deleted: ${describeError(error)}`);
  }

  io.stdout.write(`Deleted ${target.label}.\n`);
  for (const warning of warnings) {
    io.stderr.write(`Warning: ${warning}.\n`);
  }
  return 0;
}

function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function runInteractive(command: string, args: string[]): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", (error) => {
      if (isMissingBinary(error)) {
        reject(
          new Error(
            `${command} was not found. Install the OpenSSH client (on Windows it is an optional feature) and try again.`,
          ),
        );
        return;
      }
      reject(error);
    });
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function runSsh(args: string[], io: CliOutput): Promise<number> {
  const query = expectOneArgument(args, "lewdev ssh <sandbox>");
  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);

  const block = await readDirectSshConfigBlock(target.id);
  if (block) {
    const alias = getDirectSshAlias(target.id);
    const include = await hasSshInclude();
    const configPath = getSshConfigPath();
    const sshArgs = include
      ? [alias]
      : ["-F", process.platform === "win32" ? configPath.replaceAll("\\", "/") : configPath, alias];
    return runInteractive("ssh", sshArgs);
  }

  if (!(await privateKeyExists(target.id))) {
    io.stderr.write(`${SSH_NOT_SET_UP}\n`);
    return 1;
  }

  await ensureKnownHostsFile();
  const argv = buildSshArgv({
    sandboxId: target.id,
    host: sshHostFromApiUrl(context.config.apiUrl),
    keyPath: getKeyPath(target.id),
    knownHostsPath: getKnownHostsPath(),
  });
  const [command, ...sshArgs] = argv;
  return runInteractive(command ?? "ssh", sshArgs);
}

async function runCode(args: string[], io: CliOutput): Promise<number> {
  if (args.length < 1 || args.length > 2 || args[0] === undefined || args[0].startsWith("-")) {
    throw new Error("Usage: lewdev code <sandbox> [remote-path]");
  }
  const query = args[0];
  const remotePath = args[1];
  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);

  const block = await readDirectSshConfigBlock(target.id);
  if (!block) {
    io.stderr.write(`${SSH_NOT_SET_UP}\n`);
    return 1;
  }
  if (!(await hasSshInclude())) {
    io.stderr.write(
      'VS Code needs lewdev\'s SSH config included in ~/.ssh/config. Choose "Set up SSH" in the TUI first.\n',
    );
    return 1;
  }

  const directory = remotePath === undefined ? "/root" : resolveRemotePath("/root", remotePath);
  if (block.mode === "public") {
    await ensureSshdRunning(context.api, target.id);
  }
  await openInVscode(target.id, directory);
  io.stdout.write("Opening VS Code. The Remote - SSH extension is required.\n");
  return 0;
}

/** Quotes one command argument for the sandbox's POSIX shell. */
function remoteQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function runExec(args: string[], io: CliOutput): Promise<number> {
  const separator = args.indexOf("--");
  if (separator !== 1) {
    throw new Error("Usage: lewdev exec <sandbox> -- <command...>");
  }
  const query = args[0];
  const commandArgs = args.slice(separator + 1);
  if (query === undefined || commandArgs.length === 0) {
    throw new Error("Usage: lewdev exec <sandbox> -- <command...>");
  }

  const context = await requireApi(io);
  if (!context) {
    return 1;
  }
  const target = await resolveTarget(context.api, query);

  const stream = await context.api.execStream(target.id, {
    command: commandArgs.map(remoteQuote).join(" "),
    onStdout: (chunk) => {
      io.stdout.write(chunk);
    },
    onStderr: (chunk) => {
      io.stderr.write(chunk);
    },
    onError: (message) => {
      io.stderr.write(`${message}\n`);
    },
  });
  // Ctrl+C, termination and hangup go to the remote command instead of
  // killing lewdev and leaving it running in the sandbox.
  const forwarded = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const forward = (signal: NodeJS.Signals): void => {
    stream.signal(signal.replace(/^SIG/, ""));
  };
  for (const signal of forwarded) {
    process.on(signal, forward);
  }
  try {
    const exit = await stream.done;
    return exit.code >= 0 ? exit.code : 1;
  } finally {
    for (const signal of forwarded) {
      process.off(signal, forward);
    }
  }
}
