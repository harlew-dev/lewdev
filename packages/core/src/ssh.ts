import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { appendFile, chmod, open, readFile, stat } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";

import { getConfigDir, normalizeApiUrl } from "./config.js";
import { sanitizeSandboxId } from "./keys.js";
import { ensurePrivateDir } from "./private-dir.js";

type Env = Record<string, string | undefined>;

export const SSH_PORT = 2220;

const SSH_KEYSCAN_MISSING =
  "ssh-keyscan was not found. Install the OpenSSH client (on Windows it is an optional feature) and try again.";

export interface SshTarget {
  sandboxId: string;
  host: string;
  keyPath: string;
  port?: number;
  /** lewdev's own known_hosts file; when set, ssh ignores ~/.ssh/known_hosts. */
  knownHostsPath?: string;
}

export interface GatewayHostKey {
  /** Full known_hosts line for the gateway, without a trailing comment. */
  line: string;
  /** Key algorithm as it appears in known_hosts, e.g. `ssh-ed25519`. */
  algorithm: string;
  /** Base64 key blob. */
  blob: string;
  /** SHA256 fingerprint, e.g. `SHA256:abc…`. */
  fingerprint: string;
  /** Resolved gateway addresses that served this key. */
  addresses: string[];
}

export interface GatewayHostKeyScan {
  /** known_hosts name for the gateway, e.g. `[gateway.example.com]:2220`. */
  entry: string;
  keys: GatewayHostKey[];
  /** Addresses that could not be scanned. */
  failedAddresses: string[];
}

export interface ScanGatewayHostKeysOptions {
  port?: number;
  /** Resolves a hostname to every address; defaults to a DNS lookup. */
  resolve?: (host: string) => Promise<string[]>;
  /** Runs ssh-keyscan for one address; defaults to the system ssh-keyscan. */
  keyscan?: (address: string, port: number) => Promise<string>;
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

  const argv = ["ssh", "-i", target.keyPath, "-p", String(port), "-o", "IdentitiesOnly=yes"];
  if (target.knownHostsPath) {
    const path =
      process.platform === "win32"
        ? target.knownHostsPath.replaceAll("\\", "/")
        : target.knownHostsPath;
    argv.push("-o", `UserKnownHostsFile=${path}`);
  }
  argv.push(`${sandboxId}@${target.host}`);
  return argv;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }
  if (process.platform === "win32") {
    return `'${value.replaceAll("'", "''")}'`;
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
  await ensurePrivateDir(configDir);
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

function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function removeHostKeyEntry(
  entry: string,
  path: string,
  operation: string,
): Promise<boolean> {
  const output = await new Promise<string>((resolve, reject) => {
    execFile("ssh-keygen", ["-R", entry, "-f", path], (error, stdout, stderr) => {
      if (error) {
        const detail = `${stderr}`.trim() || error.message;
        reject(new Error(`${operation}: ${detail}`));
        return;
      }
      resolve(`${stdout}\n${stderr}`);
    });
  });
  await chmod(path, 0o600).catch(() => {});
  return /found:/i.test(output);
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

  return removeHostKeyEntry(entry, path, "Could not forget the saved host key");
}

function keyFingerprint(blob: string): string {
  const digest = createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}

function parseKeyscanOutput(output: string): Array<{ algorithm: string; blob: string }> {
  const keys: Array<{ algorithm: string; blob: string }> = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const fields = line.split(/\s+/);
    const algorithm = fields[1];
    const blob = fields[2];
    if (
      algorithm &&
      blob &&
      /^[A-Za-z0-9@._-]+$/.test(algorithm) &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(blob)
    ) {
      keys.push({ algorithm, blob });
    }
  }
  return keys;
}

async function resolveGatewayAddresses(host: string): Promise<string[]> {
  if (isIP(host) !== 0) {
    return [host];
  }
  const addresses = await lookup(host, { all: true });
  return [...new Set(addresses.map((entry) => entry.address))];
}

function runSshKeyscan(address: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("ssh-keyscan", ["-p", String(port), "-T", "5", address], (error, stdout, stderr) => {
      if (error) {
        if (isMissingBinary(error)) {
          reject(new Error(SSH_KEYSCAN_MISSING));
          return;
        }
        const detail = `${stderr}`.trim() || error.message;
        reject(new Error(`ssh-keyscan failed for ${address}: ${detail}`));
        return;
      }
      resolve(`${stdout}`);
    });
  });
}

/**
 * Collects every gateway node's host key. The gateway hostname resolves to
 * several addresses, each with its own key, so the scan runs ssh-keyscan against
 * each address and merges identical keys. Addresses that fail are reported so
 * the caller can warn that those nodes may still fail to connect.
 */
export async function scanGatewayHostKeys(
  host: string,
  options: ScanGatewayHostKeysOptions = {},
): Promise<GatewayHostKeyScan> {
  const port = options.port ?? SSH_PORT;
  const entry = knownHostsEntry(host, port);
  const resolveAddresses = options.resolve ?? resolveGatewayAddresses;
  const keyscan = options.keyscan ?? runSshKeyscan;

  let addresses: string[];
  try {
    addresses = [...new Set(await resolveAddresses(host))];
  } catch (error) {
    throw new Error(`Could not resolve ${host}: ${errorDetail(error)}`);
  }
  if (addresses.length === 0) {
    throw new Error(`No addresses were found for ${host}.`);
  }

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        return { address, output: await keyscan(address, port), error: null as unknown };
      } catch (error) {
        return { address, output: "", error };
      }
    }),
  );

  const merged = new Map<string, { algorithm: string; blob: string; addresses: string[] }>();
  const failedAddresses: string[] = [];
  let missingTool = false;
  let firstFailure: string | null = null;

  for (const result of results) {
    if (result.error !== null) {
      failedAddresses.push(result.address);
      if (isMissingBinary(result.error)) {
        missingTool = true;
      }
      firstFailure ??= errorDetail(result.error);
      continue;
    }
    const scanned = parseKeyscanOutput(result.output);
    if (scanned.length === 0) {
      failedAddresses.push(result.address);
      continue;
    }
    for (const key of scanned) {
      const id = `${key.algorithm} ${key.blob}`;
      const existing = merged.get(id);
      if (existing) {
        if (!existing.addresses.includes(result.address)) {
          existing.addresses.push(result.address);
        }
        continue;
      }
      merged.set(id, { ...key, addresses: [result.address] });
    }
  }

  if (merged.size === 0) {
    if (missingTool) {
      throw new Error(SSH_KEYSCAN_MISSING);
    }
    const detail = firstFailure ? ` ${firstFailure}` : "";
    throw new Error(`No host keys came back for ${entry}.${detail}`);
  }

  return {
    entry,
    keys: [...merged.values()].map((key) => ({
      line: `${entry} ${key.algorithm} ${key.blob}`,
      algorithm: key.algorithm,
      blob: key.blob,
      fingerprint: keyFingerprint(key.blob),
      addresses: key.addresses,
    })),
    failedAddresses,
  };
}

/**
 * Replaces the saved gateway entries in lewdev's known_hosts with the scanned
 * keys. Entries for other hosts are kept and the file stays mode 0600.
 */
export async function saveGatewayHostKeys(
  host: string,
  keys: GatewayHostKey[],
  port: number = SSH_PORT,
  env: Env = process.env,
): Promise<string> {
  const entry = knownHostsEntry(host, port);
  if (keys.length === 0) {
    throw new Error(`No host keys to save for ${entry}.`);
  }

  const path = await ensureKnownHostsFile(env);
  await removeHostKeyEntry(entry, path, "Could not replace the saved host keys");
  const lines = keys.map((key) => `${entry} ${key.algorithm} ${key.blob}`);
  const existing = await readFile(path, "utf8");
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await appendFile(path, `${separator}${lines.join("\n")}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}
