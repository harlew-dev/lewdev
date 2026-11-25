import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deletePrivateKey,
  getKeyPath,
  getKeysDir,
  KeyStorageError,
  privateKeyExists,
  readPrivateKey,
  savePrivateKey,
} from "../src/index.js";

let root = "";
let env: Record<string, string> = {};
const posixModes = process.platform !== "win32";

// Windows directory protection shells out to PowerShell, which can be slow to start.
setDefaultTimeout(30_000);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lewdev-keys-"));
  env = { XDG_CONFIG_HOME: root };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("private key storage", () => {
  test("saves a key with private permissions and a trailing newline", async () => {
    const path = await savePrivateKey("sb-0123456789abcdef", "PRIVATE KEY", env);
    expect(path).toBe(join(getKeysDir(env), "sb-0123456789abcdef"));
    expect(await readFile(path, "utf8")).toBe("PRIVATE KEY\n");
    if (posixModes) {
      expect((await stat(getKeysDir(env))).mode & 0o777).toBe(0o700);
      expect((await stat(join(root, "lewdev"))).mode & 0o777).toBe(0o700);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
    expect(await privateKeyExists("sb-0123456789abcdef", env)).toBe(true);
    expect(await readPrivateKey("sb-0123456789abcdef", env)).toBe("PRIVATE KEY\n");
  });

  test("restricts an existing key file again when overwriting", async () => {
    const path = await savePrivateKey("sb-abc", "one", env);
    await chmod(path, 0o644);
    await savePrivateKey("sb-abc", "two", env);
    if (posixModes) {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
    expect(await readFile(path, "utf8")).toBe("two\n");
  });

  test("returns null for a missing key and deletes idempotently", async () => {
    expect(await readPrivateKey("sb-missing", env)).toBeNull();
    expect(await privateKeyExists("sb-missing", env)).toBe(false);
    await savePrivateKey("sb-abc", "key", env);
    await deletePrivateKey("sb-abc", env);
    expect(await privateKeyExists("sb-abc", env)).toBe(false);
    await deletePrivateKey("sb-abc", env);
  });

  test("rejects unsafe sandbox IDs and empty keys", async () => {
    for (const id of ["", ".", "..", "../escape", "a/b", "/absolute", "a b"]) {
      expect(() => getKeyPath(id, env)).toThrow(KeyStorageError);
    }
    await expect(savePrivateKey("sb-abc", "   ", env)).rejects.toBeInstanceOf(KeyStorageError);
  });
});
