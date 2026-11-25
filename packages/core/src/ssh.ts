import { normalizeApiUrl } from "./config.js";
import { sanitizeSandboxId } from "./keys.js";

export const SSH_PORT = 2220;

export interface SshTarget {
  sandboxId: string;
  host: string;
  keyPath: string;
  port?: number;
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

  return ["ssh", "-i", target.keyPath, "-p", String(port), `${sandboxId}@${target.host}`];
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
