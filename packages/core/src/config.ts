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

/** A saved server, without its token, safe to render. */
export interface ProfileSummary {
  name: string;
  apiUrl: string;
  active: boolean;
}

export interface LoadedConfig {
  config: LewdevConfig | null;
  source: ConfigSource | null;
  configDir: string;
  configPath: string;
  /** The profile the config came from; null when nothing is saved for it. */
  profile: string | null;
  /** Every saved profile, tokens omitted. */
  profiles: ProfileSummary[];
}

export interface ProfileOptions {
  /** Use this profile instead of `LEWDEV_PROFILE` or the active one. */
  profile?: string;
}

export interface SaveConfigOptions extends ProfileOptions {
  /** Make the saved profile the active one. Defaults to true. */
  activate?: boolean;
}

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** The profile an existing single-server config becomes. */
export const DEFAULT_PROFILE = "default";

const PROFILE_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Lowercases a profile name and rejects anything unsafe to put in a command line. */
export function normalizeProfileName(input: string): string {
  const name = input.trim().toLowerCase();
  if (!PROFILE_NAME.test(name)) {
    throw new ConfigError(
      "Profile names use 1-32 lowercase letters, digits, - or _, starting with a letter or digit.",
    );
  }
  return name;
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

interface StoredProfile {
  apiUrl?: string;
  apiToken?: string;
}

/** The parsed file. The version 1 layout (top-level apiUrl/apiToken) reads as one profile. */
interface ConfigFile {
  activeProfile: string;
  profiles: Record<string, StoredProfile>;
}

function readStoredProfile(value: unknown, path: string, label: string): StoredProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(`Config at ${path} has an invalid ${label}.`);
  }
  const data = value as Record<string, unknown>;
  if (data.apiUrl !== undefined && typeof data.apiUrl !== "string") {
    throw new ConfigError(`Config at ${path} has a non-string apiUrl in ${label}.`);
  }
  if (data.apiToken !== undefined && typeof data.apiToken !== "string") {
    throw new ConfigError(`Config at ${path} has a non-string apiToken in ${label}.`);
  }
  return {
    apiUrl: clean(data.apiUrl as string | undefined),
    apiToken: clean(data.apiToken as string | undefined),
  };
}

async function readConfigFile(path: string): Promise<ConfigFile | null> {
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
  if (data.profiles === undefined) {
    // Version 1: a single server.
    return {
      activeProfile: DEFAULT_PROFILE,
      profiles: { [DEFAULT_PROFILE]: readStoredProfile(data, path, "config") },
    };
  }

  if (typeof data.profiles !== "object" || data.profiles === null || Array.isArray(data.profiles)) {
    throw new ConfigError(`Config at ${path} has an invalid profiles object.`);
  }
  const profiles: Record<string, StoredProfile> = {};
  for (const [name, value] of Object.entries(data.profiles as Record<string, unknown>)) {
    if (!PROFILE_NAME.test(name)) {
      throw new ConfigError(`Config at ${path} has an invalid profile name "${name}".`);
    }
    profiles[name] = readStoredProfile(value, path, `profile "${name}"`);
  }
  const active =
    typeof data.activeProfile === "string" && PROFILE_NAME.test(data.activeProfile)
      ? data.activeProfile
      : (Object.keys(profiles)[0] ?? DEFAULT_PROFILE);
  return { activeProfile: active, profiles };
}

async function writeConfigFile(file: ConfigFile, env: Env): Promise<void> {
  const configDir = getConfigDir(env);
  const configPath = getConfigPath(env);
  const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(
    { version: 2, activeProfile: file.activeProfile, profiles: file.profiles },
    null,
    2,
  )}\n`;

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
}

function summaries(file: ConfigFile | null): ProfileSummary[] {
  if (!file) {
    return [];
  }
  return Object.entries(file.profiles)
    .filter(([, profile]) => profile.apiUrl !== undefined)
    .map(([name, profile]) => ({
      name,
      apiUrl: profile.apiUrl ?? "",
      active: name === file.activeProfile,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Loads one profile, then applies `SB_API_URL` / `SB_API_TOKEN` on top of it
 * field by field. The profile is `options.profile`, else `LEWDEV_PROFILE`,
 * else the active one. Naming a profile that does not exist is an error, so a
 * typo never silently talks to a different server. A config is usable only
 * when both fields are present.
 */
export async function loadConfig(
  env: Env = process.env,
  options: ProfileOptions = {},
): Promise<LoadedConfig> {
  const configDir = getConfigDir(env);
  const configPath = getConfigPath(env);
  const file = await readConfigFile(configPath);
  const profiles = summaries(file);

  const requested = options.profile ?? clean(env.LEWDEV_PROFILE);
  const profileName =
    requested === undefined
      ? (file?.activeProfile ?? DEFAULT_PROFILE)
      : normalizeProfileName(requested);
  const stored = file?.profiles[profileName];
  if (requested !== undefined && !stored) {
    throw new ConfigError(`No profile named "${profileName}". Run lewdev to add it.`);
  }

  const envUrl = clean(env.SB_API_URL);
  const envToken = clean(env.SB_API_TOKEN);
  const fileUrl = stored?.apiUrl;
  const fileToken = stored?.apiToken;

  const apiUrl = envUrl ?? fileUrl;
  const apiToken = envToken ?? fileToken;
  const profile = stored ? profileName : null;

  if (!apiUrl || !apiToken) {
    return { config: null, source: null, configDir, configPath, profile, profiles };
  }

  const normalizedUrl = normalizeApiUrl(apiUrl);
  const source: ConfigSource =
    envUrl && envToken ? "env" : !envUrl && !envToken && fileUrl && fileToken ? "file" : "mixed";

  return {
    config: { apiUrl: normalizedUrl, apiToken },
    source,
    configDir,
    configPath,
    profile,
    profiles,
  };
}

/** Every saved profile, tokens omitted. */
export async function listProfiles(env: Env = process.env): Promise<ProfileSummary[]> {
  return summaries(await readConfigFile(getConfigPath(env)));
}

/** Makes a saved profile the one lewdev uses by default. */
export async function setActiveProfile(name: string, env: Env = process.env): Promise<void> {
  const profileName = normalizeProfileName(name);
  const file = await readConfigFile(getConfigPath(env));
  if (!file?.profiles[profileName]) {
    throw new ConfigError(`No profile named "${profileName}".`);
  }
  await writeConfigFile({ ...file, activeProfile: profileName }, env);
}

/**
 * Removes a saved profile and its token. Deleting the active profile makes the
 * first remaining one active; deleting the last one removes the config file.
 */
export async function deleteProfile(name: string, env: Env = process.env): Promise<void> {
  const profileName = normalizeProfileName(name);
  const configPath = getConfigPath(env);
  const file = await readConfigFile(configPath);
  if (!file?.profiles[profileName]) {
    throw new ConfigError(`No profile named "${profileName}".`);
  }
  const profiles = { ...file.profiles };
  delete profiles[profileName];
  const remaining = Object.keys(profiles).sort();
  const first = remaining[0];
  if (first === undefined) {
    await rm(configPath, { force: true });
    return;
  }
  const activeProfile = file.activeProfile === profileName ? first : file.activeProfile;
  await writeConfigFile({ activeProfile, profiles }, env);
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

/**
 * Saves a server into a profile (the active one unless `options.profile` names
 * another) with directory mode 0700 and file mode 0600, and by default makes
 * it the active profile. Other profiles are kept.
 */
export async function saveConfig(
  config: LewdevConfig,
  env: Env = process.env,
  options: SaveConfigOptions = {},
): Promise<LewdevConfig> {
  const apiUrl = normalizeApiUrl(config.apiUrl);
  const apiToken = config.apiToken.trim();
  if (!apiToken) {
    throw new ConfigError("API token is required.");
  }

  const file = await readConfigFile(getConfigPath(env));
  const profileName =
    options.profile === undefined
      ? (file?.activeProfile ?? DEFAULT_PROFILE)
      : normalizeProfileName(options.profile);
  const profiles = { ...(file?.profiles ?? {}), [profileName]: { apiUrl, apiToken } };
  const activeProfile = options.activate === false && file ? file.activeProfile : profileName;
  await writeConfigFile({ activeProfile, profiles }, env);

  return { apiUrl, apiToken };
}
