import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ConfigError,
  getConfigDir,
  getConfigPath,
  loadConfig,
  normalizeApiUrl,
  saveConfig,
} from "../src/index.js";

let root = "";
let env: Record<string, string> = {};

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
    expect(dirMode).toBe(0o700);
    expect(fileMode).toBe(0o600);

    const raw = await readFile(getConfigPath(env), "utf8");
    expect(JSON.parse(raw)).toEqual({ apiUrl: "http://localhost:8080", apiToken: "secret" });
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
    expect((await stat(getConfigPath(env))).mode & 0o777).toBe(0o600);
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
