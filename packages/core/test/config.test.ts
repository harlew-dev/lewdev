import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ConfigError,
  deleteProfile,
  getConfigDir,
  getConfigPath,
  listProfiles,
  loadConfig,
  normalizeApiUrl,
  normalizeProfileName,
  saveConfig,
  setActiveProfile,
} from "../src/index.js";

let root = "";
let env: Record<string, string> = {};
const posixModes = process.platform !== "win32";

// Windows directory protection shells out to PowerShell, which can be slow to start.
setDefaultTimeout(30_000);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lewdev-config-"));
  env = { XDG_CONFIG_HOME: root };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("config", () => {
  test("uses XDG_CONFIG_HOME", () => {
    expect(getConfigDir(env)).toBe(join(root, "lewdev"));
    expect(getConfigPath(env)).toBe(join(root, "lewdev", "config.json"));
  });

  test("saves with normalized URL and private permissions", async () => {
    const saved = await saveConfig({ apiUrl: "localhost:8080/", apiToken: "  secret  " }, env);
    expect(saved).toEqual({ apiUrl: "http://localhost:8080", apiToken: "secret" });

    const dirMode = (await stat(getConfigDir(env))).mode & 0o777;
    const fileMode = (await stat(getConfigPath(env))).mode & 0o777;
    if (posixModes) {
      expect(dirMode).toBe(0o700);
      expect(fileMode).toBe(0o600);
    }

    const raw = await readFile(getConfigPath(env), "utf8");
    expect(JSON.parse(raw)).toEqual({
      version: 2,
      activeProfile: "default",
      profiles: { default: { apiUrl: "http://localhost:8080", apiToken: "secret" } },
    });
  });

  test("loads a file config", async () => {
    await saveConfig({ apiUrl: "https://aerol.example.com", apiToken: "file-token" }, env);
    const loaded = await loadConfig(env);
    expect(loaded.source).toBe("file");
    expect(loaded.config).toEqual({
      apiUrl: "https://aerol.example.com",
      apiToken: "file-token",
    });
    expect(loaded.configDir).toBe(getConfigDir(env));
    expect(loaded.configPath).toBe(getConfigPath(env));
  });

  test("environment variables override the file field by field", async () => {
    await saveConfig({ apiUrl: "https://file.example.com", apiToken: "file-token" }, env);

    const loaded = await loadConfig({
      ...env,
      SB_API_URL: "https://env.example.com",
      SB_API_TOKEN: "env-token",
    });
    expect(loaded.source).toBe("env");
    expect(loaded.config).toEqual({ apiUrl: "https://env.example.com", apiToken: "env-token" });
  });

  test("reports mixed when only one environment value overrides", async () => {
    await saveConfig({ apiUrl: "https://file.example.com", apiToken: "file-token" }, env);

    const loaded = await loadConfig({ ...env, SB_API_URL: "https://env.example.com" });
    expect(loaded.source).toBe("mixed");
    expect(loaded.config).toEqual({ apiUrl: "https://env.example.com", apiToken: "file-token" });
  });

  test("returns no config when nothing is set", async () => {
    const loaded = await loadConfig(env);
    expect(loaded.config).toBeNull();
    expect(loaded.source).toBeNull();
  });

  test("uses environment-only config without a file", async () => {
    const loaded = await loadConfig({
      ...env,
      SB_API_URL: "https://env.example.com",
      SB_API_TOKEN: "env-token",
    });
    expect(loaded.source).toBe("env");
    expect(loaded.config).toEqual({
      apiUrl: "https://env.example.com",
      apiToken: "env-token",
    });
  });

  test("normalizes the URL it loads", async () => {
    const loaded = await loadConfig({
      ...env,
      SB_API_URL: "env.example.com:8443/",
      SB_API_TOKEN: "env-token",
    });
    expect(loaded.config?.apiUrl).toBe("http://env.example.com:8443");
  });

  test("rejects malformed JSON with a useful error", async () => {
    await saveConfig({ apiUrl: "https://file.example.com", apiToken: "file-token" }, env);
    await writeFile(getConfigPath(env), "{not json", "utf8");
    await expect(loadConfig(env)).rejects.toBeInstanceOf(ConfigError);
  });

  test("keeps the file private when overwriting", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "one" }, env);
    await saveConfig({ apiUrl: "https://two.example.com", apiToken: "two" }, env);
    if (posixModes) {
      expect((await stat(getConfigPath(env))).mode & 0o777).toBe(0o600);
    }
  });
});

describe("normalizeApiUrl", () => {
  test("adds a scheme and removes a trailing slash", () => {
    expect(normalizeApiUrl("127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
    expect(normalizeApiUrl("https://aerol.example.com/base/")).toBe(
      "https://aerol.example.com/base",
    );
  });

  test("rejects invalid or non-http URLs", () => {
    expect(() => normalizeApiUrl(" ")).toThrow(ConfigError);
    expect(() => normalizeApiUrl("ftp://example.com")).toThrow(ConfigError);
    expect(() => normalizeApiUrl("http://")).toThrow(ConfigError);
  });
});

describe("profiles", () => {
  test("reads a version 1 config as the default profile", async () => {
    await mkdir(getConfigDir(env), { recursive: true });
    await writeFile(
      getConfigPath(env),
      JSON.stringify({ apiUrl: "https://one.example.com", apiToken: "old-token" }),
    );
    const loaded = await loadConfig(env);
    expect(loaded.profile).toBe("default");
    expect(loaded.config).toEqual({ apiUrl: "https://one.example.com", apiToken: "old-token" });
    expect(loaded.profiles).toEqual([
      { name: "default", apiUrl: "https://one.example.com", active: true },
    ]);
  });

  test("keeps other profiles when saving and switches the active one", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "one" }, env);
    await saveConfig({ apiUrl: "https://two.example.com", apiToken: "two" }, env, {
      profile: "Work",
    });

    let loaded = await loadConfig(env);
    expect(loaded.profile).toBe("work");
    expect(loaded.config?.apiToken).toBe("two");
    expect(await listProfiles(env)).toEqual([
      { name: "default", apiUrl: "https://one.example.com", active: false },
      { name: "work", apiUrl: "https://two.example.com", active: true },
    ]);

    await setActiveProfile("default", env);
    loaded = await loadConfig(env);
    expect(loaded.config?.apiToken).toBe("one");
    expect((await loadConfig(env, { profile: "work" })).config?.apiToken).toBe("two");
    expect((await loadConfig({ ...env, LEWDEV_PROFILE: "work" })).config?.apiToken).toBe("two");
  });

  test("saving without activating keeps the current profile", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "one" }, env);
    await saveConfig({ apiUrl: "https://two.example.com", apiToken: "two" }, env, {
      profile: "work",
      activate: false,
    });
    expect((await loadConfig(env)).profile).toBe("default");
  });

  test("a named profile that does not exist is an error, not a fallback", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "one" }, env);
    await expect(loadConfig(env, { profile: "missing" })).rejects.toBeInstanceOf(ConfigError);
    await expect(loadConfig({ ...env, LEWDEV_PROFILE: "missing" })).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  test("deleting the active profile activates another; deleting the last removes the file", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "one" }, env);
    await saveConfig({ apiUrl: "https://two.example.com", apiToken: "two" }, env, {
      profile: "work",
    });
    await deleteProfile("work", env);
    const loaded = await loadConfig(env);
    expect(loaded.profile).toBe("default");
    expect(loaded.profiles.map((profile) => profile.name)).toEqual(["default"]);
    const raw = await readFile(getConfigPath(env), "utf8");
    expect(raw).not.toContain("two");

    await deleteProfile("default", env);
    expect((await loadConfig(env)).config).toBeNull();
  });

  test("profile names are safe to put on a command line", () => {
    expect(normalizeProfileName(" Work_2 ")).toBe("work_2");
    for (const bad of ["", "-x", "a b", "a;rm", "a/b", "x".repeat(33), "名前"]) {
      expect(() => normalizeProfileName(bad)).toThrow(ConfigError);
    }
  });

  test("summaries never include tokens", async () => {
    await saveConfig({ apiUrl: "https://one.example.com", apiToken: "secret-one" }, env);
    expect(JSON.stringify(await listProfiles(env))).not.toContain("secret-one");
    expect(JSON.stringify((await loadConfig(env)).profiles)).not.toContain("secret-one");
  });
});
