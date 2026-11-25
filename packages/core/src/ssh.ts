import { execFile } from "node:child_process";
import { chmod, mkdir, open, stat } from "node:fs/promises";
import { join } from "node:path";

import { getConfigDir, normalizeApiUrl } from "./config.js";
import { sanitizeSandboxId } from "./keys.js";

type Env = Record<string, string | undefined>;

export const SSH_PORT = 2220;

export interface SshTarget {
  sandboxId: string;
  host: string;
  keyPath: string;
  port?: number;
  /** lewdev's own known_hosts file; when set, ssh ignores ~/.ssh/known_hosts. */
  knownHostsPath?: string;
}

/** The SSH gateway normally shares the API host's hostname. */
export function sshHostFromApiUrl(apiUrl: string): string {
  const url = new URL(normalizeApiUrl(apiUrl));
  const hostname = url.hostname;
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

export function buildSshArgv(target: SshTarget): string[] {
  const sandboxId = sanitizeSandboxId(target.sandboxId);
  const port = target.port ?? SSH_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH port: ${port}`);
  }

  const argv = ["ssh", "-i", target.keyPath, "-p", String(port)];
  if (target.knownHostsPath) {
    argv.push("-o", `UserKnownHostsFile=${target.knownHostsPath}`);
  }
  argv.push(`${sandboxId}@${target.host}`);
  return argv;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function formatSshCommand(target: SshTarget): string {
  return buildSshArgv(target).map(shellQuote).join(" ");
}

/** lewdev keeps gateway host keys apart from the user's ~/.ssh/known_hosts. */
export function getKnownHostsPath(env: Env = process.env): string {
  return join(getConfigDir(env), "known_hosts");
}

/** Creates lewdev's known_hosts (mode 0600, dir 0700) if it is missing, and returns its path. */
export async function ensureKnownHostsFile(env: Env = process.env): Promise<string> {
  const configDir = getConfigDir(env);
  const path = getKnownHostsPath(env);
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await chmod(configDir, 0o700);
  const handle = await open(path, "a", 0o600);
  await handle.close();
  await chmod(path, 0o600);
  return path;
}

/** The known_hosts name ssh records for a host and port, e.g. `[example.com]:2220`. */
export function knownHostsEntry(host: string, port: number = SSH_PORT): string {
  if (!host || /[\s,[\]*?!]/.test(host) || host.startsWith("-")) {
    throw new Error(`Invalid SSH host: ${JSON.stringify(host)}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH port: ${port}`);
  }
  return port === 22 ? host : `[${host}]:${port}`;
}

/**
 * Removes the saved host key for the gateway from lewdev's known_hosts using
 * `ssh-keygen -R`, which also handles hashed entries. The next connection asks
 * the user to trust the key the server presents. Returns whether an entry was
 * removed; a missing file means there was nothing to forget.
 */
export async function forgetHostKey(
  host: string,
  port: number = SSH_PORT,
  env: Env = process.env,
): Promise<boolean> {
  const entry = knownHostsEntry(host, port);
  const path = getKnownHostsPath(env);
  try {
    await stat(path);
  } catch {
    return false;
  }

  const output = await new Promise<string>((resolve, reject) => {
    execFile("ssh-keygen", ["-R", entry, "-f", path], (error, stdout, stderr) => {
      if (error) {
        const detail = `${stderr}`.trim() || error.message;
        reject(new Error(`Could not forget the saved host key: ${detail}`));
        return;
      }
      resolve(`${stdout}\n${stderr}`);
    });
  });
  await chmod(path, 0o600).catch(() => {});
  return /found:/i.test(output);
}
