import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import type { ExposedPortInfo, LewdevApi } from "./client.js";
import { getConfigDir } from "./config.js";
import { getKeysDir, sanitizeSandboxId } from "./keys.js";
import { ensurePrivateDir } from "./private-dir.js";
import { ensureKnownHostsFile, getKnownHostsPath, knownHostsEntry } from "./ssh.js";
import { isStandaloneBuild } from "./update.js";

type Env = Record<string, string | undefined>;

/** Container port that direct SSH exposes. */
export const DIRECT_SSH_PORT = 22;

// sshd keeps the first value it reads, so the drop-in sorts first to win over others.
const SSHD_CONFIG_DROP_IN = "/etc/ssh/sshd_config.d/00-lewdev.conf";
const SSHD_CONFIG_DROP_IN_CONTENT = `# Managed by lewdev. Re-run "Set up SSH" to repair.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
`;
const SSH_CONFIG_HEADER = "# Managed by lewdev. One block per sandbox.\n";
const SSH_INCLUDE_COMMENT = "# Added by lewdev";

export class DirectSshError extends Error {
  override name = "DirectSshError";
}

export type DirectSshMode = "private" | "public";

export const DIRECT_SSH_STEPS = [
  { id: "package", title: "Install the OpenSSH server" },
  { id: "key", title: "Create the lewdev SSH key" },
  { id: "authorized-key", title: "Authorize the key for root" },
  { id: "sshd", title: "Configure sshd" },
  { id: "port", title: "Expose TCP port 22", publicOnly: true },
  { id: "host-key", title: "Save the sandbox host key" },
  { id: "config", title: "Write the SSH config entry" },
] as const;

export type DirectSshStepId = (typeof DIRECT_SSH_STEPS)[number]["id"];

export type DirectSshStepStatus = "running" | "done" | "skipped" | "error";

export interface DirectSshProgress {
  step: DirectSshStepId;
  status: DirectSshStepStatus;
  /** Extra detail, such as why a step was skipped or what failed. */
  message?: string;
}

export interface DirectSshSetupOptions {
  env?: Env;
  homeDir?: string;
  /** Defaults to private; callers pass the current mode when re-running. */
  mode?: DirectSshMode;
  /** The lewdev executable/entry used by SSH's ProxyCommand. */
  proxyCommand?: string;
  /** Called before and after every step so the UI can show progress. */
  onProgress?: (progress: DirectSshProgress) => void;
}

export interface DirectSshSetupResult {
  alias: string;
  mode: DirectSshMode;
  host?: string;
  port?: number;
  keyPath: string;
  publicKey: string;
  knownHostsPath: string;
  sshConfigPath: string;
  /** True when the user's ~/.ssh/config already includes lewdev's ssh_config. */
  includePresent: boolean;
}

export interface AuthorizedKey {
  /** The line exactly as it appears in authorized_keys. */
  line: string;
  type: string;
  blob: string;
  comment: string;
  fingerprint: string;
  /** True when this is the public half of lewdev's direct key. */
  isLewdev: boolean;
}

export interface PublicKey {
  line: string;
  type: string;
  blob: string;
  comment: string;
  fingerprint: string;
}

export interface DirectSshConfigBlock {
  alias: string;
  mode: DirectSshMode;
  host?: string;
  port?: number;
  keyPath: string;
  knownHostsPath: string;
  /** Private mode only. */
  proxyCommand?: string;
  /** Private mode only; the known_hosts name is the alias. */
  hostKeyAlias?: string;
}

const KEY_TYPE =
  /^(?:ssh-(?:rsa|dss|ed25519)|ecdsa-sha2-nistp(?:256|384|521)|sk-(?:ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com)$/;

/**
 * The direct key sits next to the gateway key lewdev stores at create time.
 * The `.direct` suffix keeps the two apart.
 */
export function getDirectKeyPath(sandboxId: string, env: Env = process.env): string {
  return join(getKeysDir(env), `${sanitizeSandboxId(sandboxId)}.direct`);
}

export function getSshConfigPath(env: Env = process.env): string {
  return join(getConfigDir(env), "ssh_config");
}

/** The Host alias lewdev writes into its ssh_config, e.g. `lewdev-sb-abc`. */
export function getDirectSshAlias(sandboxId: string): string {
  return `lewdev-${sanitizeSandboxId(sandboxId)}`;
}

export interface LewdevCommandOptions {
  execPath?: string;
  main?: string;
  standalone?: boolean;
}

function commandPath(path: string): string {
  return configPath(path).replaceAll('"', '\\"');
}

function quoteCommandPath(path: string): string {
  return /[\s"]/.test(path) ? `"${commandPath(path)}"` : commandPath(path);
}

/** The local command SSH runs as ProxyCommand, including the entry script in dev. */
export function getLewdevCommand(options: LewdevCommandOptions = {}): string {
  const execPath = options.execPath ?? process.execPath;
  const main = options.main ?? (typeof Bun !== "undefined" ? Bun.main : (process.argv[1] ?? ""));
  const standalone = options.standalone ?? isStandaloneBuild(main);
  if (standalone || !main) {
    return quoteCommandPath(execPath);
  }
  return `${quoteCommandPath(execPath)} ${quoteCommandPath(resolve(main))}`;
}

export function getSshProxyCommand(sandboxId: string, options: LewdevCommandOptions = {}): string {
  return `${getLewdevCommand(options)} ssh-proxy ${sanitizeSandboxId(sandboxId)}`;
}

/** Known_hosts name for a block: the alias in private mode, host:port in public. */
export function getBlockKnownHostsEntry(block: DirectSshConfigBlock): string {
  if (block.mode === "private") {
    return knownHostsEntry(block.hostKeyAlias ?? block.alias, 22);
  }
  if (!block.host || !block.port) {
    throw new DirectSshError("The public SSH config block has no host and port.");
  }
  return knownHostsEntry(block.host, block.port);
}

async function removeBlockKnownHostKeys(block: DirectSshConfigBlock, env: Env): Promise<void> {
  if (block.mode === "private") {
    await removeDirectHostKeys(block.hostKeyAlias ?? block.alias, 22, env).catch(() => {});
    return;
  }
  if (block.host && block.port) {
    await removeDirectHostKeys(block.host, block.port, env).catch(() => {});
  }
}

/** OpenSSH wants forward slashes in config files, including on Windows. */
function configPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function configValue(value: string): string {
  return /[\s"#]/.test(value)
    ? `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
    : value;
}

/** Quotes for the sandbox's POSIX shell, whatever OS lewdev runs on. */
function remoteQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Quotes for the user's local shell. */
function shellQuote(value: string): string {
  if (process.platform === "win32") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function keyFingerprint(blob: string): string {
  const digest = createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}

function isMissingFile(error: unknown): boolean {
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

/**
 * Parses one OpenSSH public key line. Returns null for private keys, comments,
 * blank lines and anything that is not a single key.
 */
export function parsePublicKey(
  value: string,
  options: { allowOptions?: boolean } = {},
): PublicKey | null {
  const line = value.trim();
  if (!line || line.includes("\n") || line.includes("\r") || line.startsWith("#")) {
    return null;
  }
  if (line.includes("PRIVATE KEY")) {
    return null;
  }
  const fields = line.split(/\s+/);
  const index = fields.findIndex((field) => KEY_TYPE.test(field));
  if (index < 0) {
    return null;
  }
  if (index > 0 && options.allowOptions !== true) {
    return null;
  }
  const type = fields[index] ?? "";
  const blob = fields[index + 1] ?? "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(blob)) {
    return null;
  }
  const comment = fields.slice(index + 2).join(" ");
  const normalized = `${type} ${blob}${comment ? ` ${comment}` : ""}`;
  return {
    line: normalized,
    type,
    blob,
    comment,
    fingerprint: keyFingerprint(blob),
  };
}

/** Validates a key pasted by the user; options and private keys are refused. */
export function validatePublicKey(value: string): PublicKey {
  const key = parsePublicKey(value);
  if (!key) {
    throw new DirectSshError(
      "Enter one OpenSSH public key line, for example `ssh-ed25519 AAAA… user@host`. Private keys are never accepted.",
    );
  }
  return key;
}

/** Parses root's authorized_keys, marking lewdev's own direct key. */
export function parseAuthorizedKeys(text: string, lewdevPublicKey?: string): AuthorizedKey[] {
  const own = lewdevPublicKey ? parsePublicKey(lewdevPublicKey) : null;
  const keys: AuthorizedKey[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const key = parsePublicKey(line, { allowOptions: true });
    if (!key) {
      continue;
    }
    keys.push({
      ...key,
      line,
      isLewdev: own !== null && key.type === own.type && key.blob === own.blob,
    });
  }
  return keys;
}

export async function readAuthorizedKeys(
  api: LewdevApi,
  sandboxId: string,
  lewdevPublicKey?: string,
): Promise<AuthorizedKey[]> {
  const result = await api.exec(sandboxId, "cat /root/.ssh/authorized_keys 2>/dev/null || true");
  if (result.exitCode !== 0 || result.timedOut) {
    throw new DirectSshError(
      `Could not read root's authorized_keys: ${(result.stderr || result.stdout).trim() || "the sandbox did not answer."}`,
    );
  }
  return parseAuthorizedKeys(result.stdout, lewdevPublicKey);
}

/** Returns the stored public half of lewdev's direct key, if there is one. */
export async function readDirectPublicKey(
  sandboxId: string,
  env: Env = process.env,
): Promise<string | null> {
  return (await readFileIfPresent(`${getDirectKeyPath(sandboxId, env)}.pub`))?.trim() ?? null;
}

/** True when lewdev's direct private key exists on this machine. */
export async function directKeyExists(sandboxId: string, env: Env = process.env): Promise<boolean> {
  try {
    await stat(getDirectKeyPath(sandboxId, env));
    return true;
  } catch (error) {
    if (isMissingFile(error)) {
      return false;
    }
    throw error;
  }
}

async function readFileIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
}

async function runSshKeygen(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile("ssh-keygen", args, (error, _stdout, stderr) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new DirectSshError(
              "ssh-keygen was not found. Install the OpenSSH client and try again.",
            ),
          );
          return;
        }
        reject(new DirectSshError(`ssh-keygen failed: ${`${stderr}`.trim() || error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Ensures the sandbox has a lewdev key pair on this machine and returns its
 * public half. A missing `.pub` is regenerated from the private key.
 */
export async function ensureDirectKey(
  sandboxId: string,
  env: Env = process.env,
): Promise<{ privateKeyPath: string; publicKey: string }> {
  const keyPath = getDirectKeyPath(sandboxId, env);
  const publicPath = `${keyPath}.pub`;
  await ensurePrivateDir(getConfigDir(env));
  await ensurePrivateDir(getKeysDir(env));

  let publicKey = (await readFileIfPresent(publicPath))?.trim() ?? "";
  if (publicKey && parsePublicKey(publicKey) === null) {
    publicKey = "";
  }
  if (!(await directKeyExists(sandboxId, env))) {
    await rm(publicPath, { force: true }).catch(() => {});
    await runSshKeygen([
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-C",
      getDirectSshAlias(sandboxId),
      "-f",
      keyPath,
    ]);
    publicKey = (await readFileIfPresent(publicPath))?.trim() ?? "";
  } else if (!publicKey) {
    await new Promise<void>((resolve, reject) => {
      execFile("ssh-keygen", ["-y", "-f", keyPath], (error, stdout, stderr) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new DirectSshError(
                "ssh-keygen was not found. Install the OpenSSH client and try again.",
              ),
            );
            return;
          }
          reject(
            new DirectSshError(
              `Could not read the public half of ${basename(keyPath)}: ${`${stderr}`.trim() || error.message}`,
            ),
          );
          return;
        }
        publicKey = stdout.trim();
        resolve();
      });
    });
    await writeFile(publicPath, `${publicKey}\n`, { mode: 0o600 });
  }

  await chmod(keyPath, 0o600).catch(() => {});
  await chmod(publicPath, 0o600).catch(() => {});
  const parsed = parsePublicKey(publicKey);
  if (!parsed) {
    throw new DirectSshError("The generated SSH key does not look like an OpenSSH key.");
  }
  return { privateKeyPath: keyPath, publicKey: parsed.line };
}

function requireSuccess(result: Awaited<ReturnType<LewdevApi["exec"]>>, action: string): void {
  if (result.exitCode === 0 && !result.timedOut) {
    return;
  }
  const detail = (result.stderr || result.stdout).trim().split(/\r?\n/).slice(-8).join("\n");
  throw new DirectSshError(
    `${action} failed${result.timedOut ? " (timed out)" : ""}${detail ? `: ${detail}` : "."}`,
  );
}

// Grouped so `! ${SSH_KEY_PRESENT}` negates the whole test.
const SSH_KEY_PRESENT = `{ command -v sshd >/dev/null 2>&1 || [ -x /usr/sbin/sshd ]; }`;
const SSHD_RUNNING = `{ if command -v pgrep >/dev/null 2>&1; then pgrep -x sshd >/dev/null; elif command -v pidof >/dev/null 2>&1; then pidof sshd >/dev/null; else ps -e 2>/dev/null | grep -q '[s]shd'; fi; }`;

async function ensureSshdInstalled(api: LewdevApi, sandboxId: string): Promise<string> {
  const present = await api.exec(sandboxId, SSH_KEY_PRESENT);
  if (present.exitCode === 0) {
    return "OpenSSH server is already installed.";
  }

  const script = `set -e
if ${SSH_KEY_PRESENT}; then exit 0; fi
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends openssh-server curl ca-certificates
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache openssh-server curl ca-certificates
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y openssh-server curl ca-certificates
elif command -v yum >/dev/null 2>&1; then
  yum install -y openssh-server curl ca-certificates
else
  echo "No supported package manager (apt-get, apk, dnf, yum) was found." >&2
  exit 42
fi
if ! ${SSH_KEY_PRESENT}; then
  echo "openssh-server was installed but sshd is still missing." >&2
  exit 43
fi`;
  const result = await api.exec(sandboxId, script, { timeoutSeconds: 900 });
  requireSuccess(result, "Installing OpenSSH server");
  return "Installed openssh-server, curl and ca-certificates.";
}

async function installAuthorizedKey(
  api: LewdevApi,
  sandboxId: string,
  publicKey: string,
): Promise<string> {
  const key = validatePublicKey(publicKey);
  const script = `set -e
umask 077
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
if ! grep -qxF -- ${remoteQuote(key.line)} /root/.ssh/authorized_keys; then
  printf '%s\\n' ${remoteQuote(key.line)} >> /root/.ssh/authorized_keys
fi`;
  const result = await api.exec(sandboxId, script);
  requireSuccess(result, "Authorizing the lewdev key");
  return "Added lewdev's public key (other keys were kept).";
}

/** Adds one user-supplied key to root's authorized_keys, if it is not already there. */
export async function addAuthorizedKey(
  api: LewdevApi,
  sandboxId: string,
  publicKey: string,
): Promise<PublicKey> {
  const key = validatePublicKey(publicKey);
  const script = `set -e
umask 077
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
if ! grep -qxF -- ${remoteQuote(key.line)} /root/.ssh/authorized_keys; then
  printf '%s\\n' ${remoteQuote(key.line)} >> /root/.ssh/authorized_keys
fi`;
  const result = await api.exec(sandboxId, script);
  requireSuccess(result, "Adding the SSH key");
  return key;
}

/** Removes one exact line from root's authorized_keys. */
export async function removeAuthorizedKey(
  api: LewdevApi,
  sandboxId: string,
  line: string,
): Promise<void> {
  const script = `set -e
file=/root/.ssh/authorized_keys
if [ -f "$file" ]; then
  tmp="$file.lewdev.$$"
  grep -vxF -- ${remoteQuote(line)} "$file" > "$tmp" || true
  cat "$tmp" > "$file"
  rm -f "$tmp"
  chmod 600 "$file"
fi`;
  const result = await api.exec(sandboxId, script);
  requireSuccess(result, "Removing the SSH key");
}

const START_SSHD = `SSHD="$(command -v sshd || echo /usr/sbin/sshd)"
"$SSHD" -t
was_running=0
if ${SSHD_RUNNING}; then
  was_running=1
fi
if [ "$was_running" = 1 ]; then
  if ! "$SSHD" -T 2>/dev/null | grep -Eqx 'passwordauthentication no' \
    || ! "$SSHD" -T 2>/dev/null | grep -Eqx 'kbdinteractiveauthentication no' \
    || ! "$SSHD" -T 2>/dev/null | grep -Eq '^permitrootlogin (prohibit-password|without-password)$'; then
    pkill -x sshd 2>/dev/null || killall sshd 2>/dev/null || true
    sleep 1
  fi
fi
if ! ${SSHD_RUNNING}; then
  "$SSHD"
fi
if ! ${SSHD_RUNNING}; then
  echo "sshd did not start." >&2
  exit 44
fi
if ! "$SSHD" -T 2>/dev/null | grep -Eqx 'passwordauthentication no' \
  || ! "$SSHD" -T 2>/dev/null | grep -Eqx 'kbdinteractiveauthentication no' \
  || ! "$SSHD" -T 2>/dev/null | grep -Eq '^permitrootlogin (prohibit-password|without-password)$'; then
  echo "sshd is not using lewdev's key-only settings; a conflicting directive earlier in sshd_config may be overriding them." >&2
  exit 45
fi`;

async function configureSshd(
  api: LewdevApi,
  sandboxId: string,
  startDaemon: boolean,
): Promise<string> {
  await api.uploadFile(sandboxId, SSHD_CONFIG_DROP_IN, SSHD_CONFIG_DROP_IN_CONTENT, {
    mode: 0o644,
  });
  const script = `set -e
mkdir -p /etc/ssh/sshd_config.d /run/sshd
if [ -f /etc/ssh/sshd_config ]; then
  if ! grep -Eq '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\\.d/\\*\\.conf' /etc/ssh/sshd_config; then
    tmp=$(mktemp)
    printf '# Added by lewdev\\nInclude /etc/ssh/sshd_config.d/*.conf\\n' > "$tmp"
    cat /etc/ssh/sshd_config >> "$tmp"
    cat "$tmp" > /etc/ssh/sshd_config
    rm -f "$tmp"
  fi
fi
ssh-keygen -A
SSHD="$(command -v sshd || echo /usr/sbin/sshd)"
"$SSHD" -t
${startDaemon ? START_SSHD : ""}`;
  const result = await api.exec(sandboxId, script, { timeoutSeconds: 180 });
  requireSuccess(result, startDaemon ? "Configuring and starting sshd" : "Configuring sshd");
  return startDaemon
    ? "Configured key-only root login and started sshd."
    : "Configured key-only sshd for private ProxyCommand access.";
}

/** Starts sshd if it is installed but not running. Used by "Open in VS Code". */
export async function ensureSshdRunning(api: LewdevApi, sandboxId: string): Promise<void> {
  const installed = await api.exec(sandboxId, SSH_KEY_PRESENT);
  if (installed.exitCode !== 0) {
    throw new DirectSshError('SSH is not set up for this sandbox. Choose "Set up SSH" first.');
  }
  const script = `set -e
SSHD="$(command -v sshd || echo /usr/sbin/sshd)"
"$SSHD" -t
if ! ${SSHD_RUNNING}; then
  "$SSHD"
fi
if ! ${SSHD_RUNNING}; then
  echo "sshd did not start." >&2
  exit 44
fi`;
  requireSuccess(await api.exec(sandboxId, script, { timeoutSeconds: 60 }), "Starting sshd");
}

/** Whether sshd is currently running; false when OpenSSH is not installed. */
export async function isSshdRunning(api: LewdevApi, sandboxId: string): Promise<boolean> {
  const result = await api.exec(sandboxId, `${SSH_KEY_PRESENT} && ${SSHD_RUNNING}`);
  return result.exitCode === 0 && !result.timedOut;
}

/** Reads the sandbox's own sshd host public keys through the authenticated API. */
export async function readSshdHostKeys(api: LewdevApi, sandboxId: string): Promise<PublicKey[]> {
  const result = await api.exec(
    sandboxId,
    "cat /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_rsa_key.pub 2>/dev/null || true",
  );
  if (result.exitCode !== 0 || result.timedOut) {
    throw new DirectSshError(
      `Could not read the sandbox host key: ${(result.stderr || result.stdout).trim() || "the sandbox did not answer."}`,
    );
  }
  const keys = result.stdout
    .split(/\r?\n/)
    .map((line) => parsePublicKey(line))
    .filter((key): key is PublicKey => key !== null);
  if (keys.length === 0) {
    throw new DirectSshError("No sshd host key was found in the sandbox.");
  }
  return keys;
}

/** Replaces lewdev's known_hosts entries for one host and port. */
export async function saveDirectHostKeys(
  host: string,
  port: number,
  keys: PublicKey[],
  env: Env = process.env,
): Promise<string> {
  const entry = knownHostsEntry(host, port);
  if (keys.length === 0) {
    throw new DirectSshError(`No host keys to save for ${entry}.`);
  }
  const path = await ensureKnownHostsFile(env);
  const existing = await readFileIfPresent(path);
  const kept =
    existing === null
      ? []
      : existing
          .split(/\r?\n/)
          .filter((line) => line.trim().length > 0 && line.split(/\s+/)[0] !== entry);
  const lines = keys.map((key) => `${entry} ${key.type} ${key.blob}`);
  await writeFile(path, `${[...kept, ...lines].join("\n")}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}

/** Removes lewdev's known_hosts entry for a host and port. */
export async function removeDirectHostKeys(
  host: string,
  port: number,
  env: Env = process.env,
): Promise<boolean> {
  const entry = knownHostsEntry(host, port);
  const path = getKnownHostsPath(env);
  const existing = await readFileIfPresent(path);
  if (existing === null) {
    return false;
  }
  const lines = existing.split(/\r?\n/);
  const kept = lines.filter((line) => line.split(/\s+/)[0] !== entry);
  if (kept.length === lines.length) {
    return false;
  }
  await writeFile(path, `${kept.join("\n").replace(/\n+$/, "")}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return true;
}

export function formatDirectSshCommand(sandboxId: string): string {
  return `ssh ${getDirectSshAlias(sandboxId)}`;
}

/** The explicit command, for when `~/.ssh/config` has no lewdev Include. */
export function formatExplicitSshCommand(block: DirectSshConfigBlock): string {
  const common = [
    "ssh",
    "-i",
    shellQuote(block.keyPath),
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    `UserKnownHostsFile=${shellQuote(block.knownHostsPath)}`,
    "-o",
    "StrictHostKeyChecking=yes",
  ];
  if (block.mode === "private") {
    if (!block.proxyCommand) {
      throw new DirectSshError("The private SSH config block has no ProxyCommand.");
    }
    return [
      ...common,
      "-o",
      `ProxyCommand=${shellQuote(block.proxyCommand)}`,
      "-o",
      `HostKeyAlias=${block.hostKeyAlias ?? block.alias}`,
      `root@${block.alias}`,
    ].join(" ");
  }
  if (!block.host || !block.port) {
    throw new DirectSshError("The public SSH config block has no host and port.");
  }
  return [...common, "-p", String(block.port), `root@${block.host}`].join(" ");
}

function renderConfigBlock(block: DirectSshConfigBlock): string {
  if (block.mode === "private") {
    if (!block.proxyCommand) {
      throw new DirectSshError("The private SSH config block has no ProxyCommand.");
    }
    return [
      `Host ${block.alias}`,
      "    User root",
      `    ProxyCommand ${block.proxyCommand}`,
      `    HostKeyAlias ${block.hostKeyAlias ?? block.alias}`,
      `    IdentityFile ${configValue(configPath(block.keyPath))}`,
      "    IdentitiesOnly yes",
      `    UserKnownHostsFile ${configValue(configPath(block.knownHostsPath))}`,
      "    StrictHostKeyChecking yes",
    ].join("\n");
  }
  if (!block.host || !block.port) {
    throw new DirectSshError("The public SSH config block has no host and port.");
  }
  return [
    `Host ${block.alias}`,
    `    HostName ${block.host}`,
    `    Port ${block.port}`,
    "    User root",
    `    IdentityFile ${configValue(configPath(block.keyPath))}`,
    "    IdentitiesOnly yes",
    `    UserKnownHostsFile ${configValue(configPath(block.knownHostsPath))}`,
    "    StrictHostKeyChecking yes",
  ].join("\n");
}

function stripConfigBlock(text: string, alias: string): { text: string; removed: boolean } {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let removed = false;
  let skipping = false;
  for (const line of lines) {
    const isHost = /^\s*Host\s+/i.test(line);
    const isMatch = /^\s*Match\s+/i.test(line);
    if (isHost || isMatch) {
      const fields = line.trim().split(/\s+/);
      if (isHost && fields[1] === alias) {
        skipping = true;
        removed = true;
        continue;
      }
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  return {
    text: kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd(),
    removed,
  };
}

function parseConfigBlock(text: string, alias: string): DirectSshConfigBlock | null {
  const lines = text.split(/\r?\n/);
  let inside = false;
  const values = new Map<string, string>();
  for (const line of lines) {
    if (/^\s*Host\s+/i.test(line)) {
      const fields = line.trim().split(/\s+/);
      if (inside) {
        break;
      }
      inside = fields[1] === alias;
      continue;
    }
    if (!inside) {
      continue;
    }
    if (/^\s*Match\s+/i.test(line)) {
      break;
    }
    const match = /^\s*([A-Za-z]+)\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    values.set((match[1] ?? "").toLowerCase(), (match[2] ?? "").replace(/^"(.*)"$/, "$1"));
  }
  const host = values.get("hostname");
  const port = Number(values.get("port"));
  const keyPath = values.get("identityfile");
  const knownHostsPath = values.get("userknownhostsfile");
  const proxyCommand = values.get("proxycommand");
  const hostKeyAlias = values.get("hostkeyalias");
  if (!inside && values.size === 0) {
    return null;
  }
  if (!keyPath || !knownHostsPath) {
    return null;
  }
  if (proxyCommand) {
    return {
      alias,
      mode: "private",
      keyPath,
      knownHostsPath,
      proxyCommand,
      hostKeyAlias: hostKeyAlias ?? alias,
    };
  }
  if (!host || !Number.isInteger(port)) {
    return null;
  }
  return { alias, mode: "public", host, port, keyPath, knownHostsPath };
}

/** Writes or replaces the sandbox's block in lewdev's ssh_config. */
export async function writeDirectSshConfigBlock(
  block: DirectSshConfigBlock,
  env: Env = process.env,
): Promise<string> {
  const path = getSshConfigPath(env);
  await ensurePrivateDir(dirname(path));
  const existing = (await readFileIfPresent(path)) ?? `${SSH_CONFIG_HEADER}`;
  const stripped = stripConfigBlock(existing, block.alias);
  const base = stripped.text.trim();
  const content = `${base ? `${base}\n\n` : `${SSH_CONFIG_HEADER}\n`}${renderConfigBlock(block)}\n`;
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content, { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, path);
  await chmod(path, 0o600);
  return path;
}

/** Removes the sandbox's block; returns true when one was present. */
export async function removeDirectSshConfigBlock(
  sandboxId: string,
  env: Env = process.env,
): Promise<boolean> {
  const path = getSshConfigPath(env);
  const existing = await readFileIfPresent(path);
  if (existing === null) {
    return false;
  }
  const stripped = stripConfigBlock(existing, getDirectSshAlias(sandboxId));
  if (!stripped.removed) {
    return false;
  }
  const content = stripped.text ? `${stripped.text}\n` : "";
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
  return true;
}

export async function hasDirectSshConfigBlock(
  sandboxId: string,
  env: Env = process.env,
): Promise<boolean> {
  const existing = await readFileIfPresent(getSshConfigPath(env));
  return existing !== null && parseConfigBlock(existing, getDirectSshAlias(sandboxId)) !== null;
}

export async function readDirectSshConfigBlock(
  sandboxId: string,
  env: Env = process.env,
): Promise<DirectSshConfigBlock | null> {
  const existing = await readFileIfPresent(getSshConfigPath(env));
  return existing === null ? null : parseConfigBlock(existing, getDirectSshAlias(sandboxId));
}

/** The Include line lewdev adds to the user's ~/.ssh/config. */
export function getSshIncludeLine(env: Env = process.env): string {
  return `Include ${configValue(configPath(getSshConfigPath(env)))}`;
}

function sshConfigFile(home: string): string {
  return join(home, ".ssh", "config");
}

function hasInclude(content: string, env: Env): boolean {
  const wanted = getSshIncludeLine(env);
  return content.split(/\r?\n/).some((line) => line.trim().replace(/\s+/g, " ") === wanted);
}

/** Whether the user's ~/.ssh/config already includes lewdev's ssh_config. */
export async function hasSshInclude(
  options: { env?: Env; homeDir?: string } = {},
): Promise<boolean> {
  const content = await readFileIfPresent(sshConfigFile(options.homeDir ?? homedir()));
  return content !== null && hasInclude(content, options.env ?? process.env);
}

/**
 * Adds lewdev's Include at the top of the user's ~/.ssh/config once. Existing
 * content is left byte-for-byte intact below it.
 */
export async function addSshInclude(
  options: { env?: Env; homeDir?: string } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const home = options.homeDir ?? homedir();
  const sshDir = join(home, ".ssh");
  const path = sshConfigFile(home);
  const existing = await readFileIfPresent(path);
  if (existing !== null && hasInclude(existing, env)) {
    return false;
  }
  await ensurePrivateDir(sshDir);
  const block = `${SSH_INCLUDE_COMMENT}\n${getSshIncludeLine(env)}\n`;
  const content = existing === null ? block : `${block}${existing}`;
  await writeFile(path, content, { mode: 0o600 });
  if (existing === null) {
    await chmod(path, 0o600);
  }
  return true;
}

async function exposeDirectPort(api: LewdevApi, sandboxId: string): Promise<ExposedPortInfo> {
  const opened = await api.openTcpPort(sandboxId, DIRECT_SSH_PORT);
  if (!opened.host || !opened.hostPort) {
    throw new DirectSshError("The server did not return a TCP host and port for SSH.");
  }
  return opened;
}

/**
 * The idempotent direct-SSH setup flow. Every step checks the sandbox first,
 * so re-running it repairs a stopped sshd, a missing key or a lost exposure.
 */
export async function setupDirectSsh(
  api: LewdevApi,
  sandboxId: string,
  options: DirectSshSetupOptions = {},
): Promise<DirectSshSetupResult> {
  const env = options.env ?? process.env;
  const mode = options.mode ?? "private";
  const report = options.onProgress ?? (() => {});
  const run = async <T>(
    step: DirectSshStepId,
    action: () => Promise<{ value: T; message?: string }>,
  ): Promise<T> => {
    report({ step, status: "running" });
    try {
      const { value, message } = await action();
      report({ step, status: "done", ...(message === undefined ? {} : { message }) });
      return value;
    } catch (error) {
      report({ step, status: "error", message: errorDetail(error) });
      throw error;
    }
  };
  const skip = (step: DirectSshStepId, message: string): void => {
    report({ step, status: "skipped", message });
  };

  let keyPath = "";
  let publicKey = "";
  await run("package", async () => {
    const message = await ensureSshdInstalled(api, sandboxId);
    return { value: undefined, message };
  });
  await run("key", async () => {
    const key = await ensureDirectKey(sandboxId, env);
    keyPath = key.privateKeyPath;
    publicKey = key.publicKey;
    return {
      value: undefined,
      message: `Using ${basename(key.privateKeyPath)} in lewdev's keys directory.`,
    };
  });
  await run("authorized-key", async () => {
    const message = await installAuthorizedKey(api, sandboxId, publicKey);
    return { value: undefined, message };
  });
  await run("sshd", async () => {
    const message = await configureSshd(api, sandboxId, mode === "public");
    return { value: undefined, message };
  });

  let host: string | undefined;
  let port: number | undefined;
  if (mode === "public") {
    const opened = await run("port", async () => {
      const value = await exposeDirectPort(api, sandboxId);
      return { value, message: `Port 22 is exposed on ${value.host}:${value.hostPort}.` };
    });
    host = opened.host;
    port = opened.hostPort;
  } else {
    skip("port", "Private mode uses the AerolVM API; no port is exposed.");
  }

  const alias = getDirectSshAlias(sandboxId);
  const hostKeyAlias = alias;
  const knownHostsEntryName =
    mode === "private"
      ? knownHostsEntry(hostKeyAlias, 22)
      : host && port
        ? knownHostsEntry(host, port)
        : "";
  await run("host-key", async () => {
    const keys = await readSshdHostKeys(api, sandboxId);
    if (!knownHostsEntryName) {
      throw new DirectSshError("The public SSH endpoint has no host and port.");
    }
    const path =
      mode === "private"
        ? await saveDirectHostKeys(hostKeyAlias, 22, keys, env)
        : await saveDirectHostKeys(host ?? "", port ?? 0, keys, env);
    return { value: undefined, message: `Saved ${keys.length} host key(s) to ${basename(path)}.` };
  });
  const proxyCommand =
    mode === "private" ? (options.proxyCommand ?? getSshProxyCommand(sandboxId)) : undefined;
  const sshConfigPath = await run("config", async () => {
    const path = await writeDirectSshConfigBlock(
      {
        alias,
        mode,
        ...(host === undefined ? {} : { host }),
        ...(port === undefined ? {} : { port }),
        keyPath,
        knownHostsPath: getKnownHostsPath(env),
        ...(proxyCommand === undefined ? {} : { proxyCommand }),
        ...(mode === "private" ? { hostKeyAlias } : {}),
      },
      env,
    );
    return {
      value: path,
      message: `Wrote Host ${alias} (${mode}) to ${basename(path)}.`,
    };
  });

  const includePresent = await hasSshInclude({ env, homeDir: options.homeDir });

  return {
    alias,
    mode,
    ...(host === undefined ? {} : { host }),
    ...(port === undefined ? {} : { port }),
    keyPath,
    publicKey,
    knownHostsPath: getKnownHostsPath(env),
    sshConfigPath,
    includePresent,
  };
}

/** Stops sshd, removes the port exposure, lewdev's ssh_config block and its saved host keys. */
export async function disableDirectSsh(
  api: LewdevApi,
  sandboxId: string,
  env: Env = process.env,
): Promise<void> {
  const details = await api.getSandbox(sandboxId);
  const exposed = details.exposedPorts.find(
    (port) => port.port === DIRECT_SSH_PORT && (port.protocol === "tcp" || port.host !== undefined),
  );
  let failure: unknown = null;
  if (exposed) {
    try {
      await api.closePort(sandboxId, DIRECT_SSH_PORT);
    } catch (error) {
      failure = error;
    }
  }
  try {
    const result = await api.exec(
      sandboxId,
      `if ${SSHD_RUNNING}; then pkill -x sshd 2>/dev/null || killall sshd 2>/dev/null || true; fi`,
    );
    requireSuccess(result, "Stopping sshd");
  } catch (error) {
    failure ??= error;
  }
  const block = await readDirectSshConfigBlock(sandboxId, env);
  if (block) {
    await removeBlockKnownHostKeys(block, env);
  }
  await removeDirectSshConfigBlock(sandboxId, env);
  if (failure !== null) {
    throw failure;
  }
}

export interface DirectSshSwitchOptions {
  env?: Env;
  proxyCommand?: string;
}

/** Switches a configured sandbox to public TCP SSH, starting sshd and exposing port 22. */
export async function enablePublicDirectSsh(
  api: LewdevApi,
  sandboxId: string,
  options: DirectSshSwitchOptions = {},
): Promise<DirectSshConfigBlock> {
  const env = options.env ?? process.env;
  const previous = await readDirectSshConfigBlock(sandboxId, env);
  const key = await ensureDirectKey(sandboxId, env);
  await configureSshd(api, sandboxId, true);
  const opened = await exposeDirectPort(api, sandboxId);
  const host = opened.host ?? "";
  const port = opened.hostPort ?? 0;
  const keys = await readSshdHostKeys(api, sandboxId);
  await saveDirectHostKeys(host, port, keys, env);
  if (previous?.mode === "private") {
    await removeDirectHostKeys(previous.hostKeyAlias ?? previous.alias, 22, env).catch(() => {});
  }
  const block: DirectSshConfigBlock = {
    alias: getDirectSshAlias(sandboxId),
    mode: "public",
    host,
    port,
    keyPath: key.privateKeyPath,
    knownHostsPath: getKnownHostsPath(env),
  };
  await writeDirectSshConfigBlock(block, env);
  return block;
}

/** Switches a configured sandbox back to private ProxyCommand SSH. */
export async function switchToPrivateSsh(
  api: LewdevApi,
  sandboxId: string,
  options: DirectSshSwitchOptions = {},
): Promise<DirectSshConfigBlock> {
  const env = options.env ?? process.env;
  const previous = await readDirectSshConfigBlock(sandboxId, env);
  const installed = await api.exec(sandboxId, SSH_KEY_PRESENT);
  if (installed.exitCode !== 0) {
    throw new DirectSshError('SSH is not set up for this sandbox. Choose "Set up SSH" first.');
  }
  const key = await ensureDirectKey(sandboxId, env);
  const alias = getDirectSshAlias(sandboxId);
  const keys = await readSshdHostKeys(api, sandboxId);
  await saveDirectHostKeys(alias, 22, keys, env);
  const result = await api.exec(
    sandboxId,
    `if ${SSHD_RUNNING}; then pkill -x sshd 2>/dev/null || killall sshd 2>/dev/null || true; fi`,
  );
  requireSuccess(result, "Stopping sshd");
  const details = await api.getSandbox(sandboxId);
  const exposed = details.exposedPorts.find((port) => port.port === DIRECT_SSH_PORT);
  if (exposed) {
    await api.closePort(sandboxId, DIRECT_SSH_PORT);
  }
  if (previous?.mode === "public" && previous.host && previous.port) {
    await removeDirectHostKeys(previous.host, previous.port, env).catch(() => {});
  }
  const block: DirectSshConfigBlock = {
    alias,
    mode: "private",
    keyPath: key.privateKeyPath,
    knownHostsPath: getKnownHostsPath(env),
    proxyCommand: options.proxyCommand ?? getSshProxyCommand(sandboxId),
    hostKeyAlias: alias,
  };
  await writeDirectSshConfigBlock(block, env);
  return block;
}

/**
 * For a sandbox that was wiped or reinstalled: best-effort remove lewdev's old
 * key from root's authorized_keys, clear all local direct-SSH state, then run
 * the normal setup flow with a fresh key. Other authorized keys are kept.
 */
export async function resetDirectSsh(
  api: LewdevApi,
  sandboxId: string,
  options: DirectSshSetupOptions = {},
): Promise<DirectSshSetupResult> {
  const env = options.env ?? process.env;
  const previous = await readDirectSshConfigBlock(sandboxId, env);
  const mode = options.mode ?? previous?.mode ?? "private";
  const publicKey = await readDirectPublicKey(sandboxId, env).catch(() => null);
  if (publicKey) {
    try {
      await removeAuthorizedKey(api, sandboxId, publicKey);
    } catch {
      // The sandbox may be wiped; setup below repairs whatever it finds.
    }
  }
  await cleanupDirectSsh(sandboxId, env);
  return setupDirectSsh(api, sandboxId, { ...options, mode });
}

/**
 * Removes local direct-SSH state for a sandbox: its ssh_config block, the
 * known_hosts entry named there, and its key pair. Root's authorized_keys is
 * left alone; the sandbox is being deleted.
 */
export async function cleanupDirectSsh(sandboxId: string, env: Env = process.env): Promise<void> {
  const block = await readDirectSshConfigBlock(sandboxId, env);
  if (block) {
    await removeBlockKnownHostKeys(block, env);
  }
  await removeDirectSshConfigBlock(sandboxId, env);
  const keyPath = getDirectKeyPath(sandboxId, env);
  await rm(keyPath, { force: true }).catch(() => {});
  await rm(`${keyPath}.pub`, { force: true }).catch(() => {});
}
