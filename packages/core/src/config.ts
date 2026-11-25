import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { ensurePrivateDir } from "./private-dir.js";

export interface LewdevConfig {
  /** Base URL of the AerolVM server, for example `http://127.0.0.1:8080`. */
  apiUrl: string;
  /** AerolVM API token. Never log or render this value. */
  apiToken: string;
}

export type ConfigSource = "env" | "file" | "mixed";

export interface LoadedConfig {
  config: LewdevConfig | null;
  source: ConfigSource | null;
  configDir: string;
  configPath: string;
}

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** `$XDG_CONFIG_HOME/lewdev`, falling back to `~/.config/lewdev`. */
export function getConfigDir(env: Env = process.env): string {
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "lewdev");
}

export function getConfigPath(env: Env = process.env): string {
  return join(getConfigDir(env), "config.json");
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function readConfigFile(path: string): Promise<Partial<LewdevConfig> | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw new ConfigError(`Could not read config at ${path}.`, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`Config at ${path} is not valid JSON.`, { cause: error });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(`Config at ${path} must be a JSON object.`);
  }

  const data = parsed as Record<string, unknown>;
  if (data.apiUrl !== undefined && typeof data.apiUrl !== "string") {
    throw new ConfigError(`Config at ${path} has a non-string apiUrl.`);
  }
  if (data.apiToken !== undefined && typeof data.apiToken !== "string") {
    throw new ConfigError(`Config at ${path} has a non-string apiToken.`);
  }

  return {
    apiUrl: clean(data.apiUrl as string | undefined),
    apiToken: clean(data.apiToken as string | undefined),
  };
}

/**
 * Loads the config file, then applies `SB_API_URL` / `SB_API_TOKEN` on top of
 * it field by field. A config is usable only when both fields are present.
 */
export async function loadConfig(env: Env = process.env): Promise<LoadedConfig> {
  const configDir = getConfigDir(env);
  const configPath = getConfigPath(env);
  const file = await readConfigFile(configPath);

  const envUrl = clean(env.SB_API_URL);
  const envToken = clean(env.SB_API_TOKEN);
  const fileUrl = file?.apiUrl;
  const fileToken = file?.apiToken;

  const apiUrl = envUrl ?? fileUrl;
  const apiToken = envToken ?? fileToken;

  if (!apiUrl || !apiToken) {
    return { config: null, source: null, configDir, configPath };
  }

  const normalizedUrl = normalizeApiUrl(apiUrl);
  const source: ConfigSource =
    envUrl && envToken ? "env" : !envUrl && !envToken && fileUrl && fileToken ? "file" : "mixed";

  return {
    config: { apiUrl: normalizedUrl, apiToken },
    source,
    configDir,
    configPath,
  };
}

/** Accepts `host:port` and adds `http://`; rejects non-HTTP schemes. */
export function normalizeApiUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ConfigError("API URL is required.");
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `http://${trimmed}`);
  } catch {
    throw new ConfigError(`"${input}" is not a valid URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("API URL must use http or https.");
  }
  if (!url.hostname) {
    throw new ConfigError("API URL must include a host.");
  }

  url.hash = "";
  url.search = "";
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${pathname}`;
}

/** Writes the config with directory mode 0700 and file mode 0600. */
export async function saveConfig(
  config: LewdevConfig,
  env: Env = process.env,
): Promise<LewdevConfig> {
  const apiUrl = normalizeApiUrl(config.apiUrl);
  const apiToken = config.apiToken.trim();
  if (!apiToken) {
    throw new ConfigError("API token is required.");
  }

  const configDir = getConfigDir(env);
  const configPath = getConfigPath(env);
  const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify({ apiUrl, apiToken }, null, 2)}\n`;

  try {
    await ensurePrivateDir(configDir);
    await writeFile(tmpPath, payload, { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, configPath);
    await chmod(configPath, 0o600);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw new ConfigError(`Could not save config at ${configPath}.`, { cause: error });
  }

  return { apiUrl, apiToken };
}
