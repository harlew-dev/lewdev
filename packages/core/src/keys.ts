import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getConfigDir } from "./config.js";
import { ensurePrivateDir } from "./private-dir.js";

type Env = Record<string, string | undefined>;

export class KeyStorageError extends Error {
  override name = "KeyStorageError";
}

/** Sandbox IDs become file names, so reject anything that could escape the keys dir. */
export function sanitizeSandboxId(sandboxId: string): string {
  if (
    !sandboxId ||
    sandboxId === "." ||
    sandboxId === ".." ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sandboxId) ||
    (process.platform === "win32" &&
      (sandboxId.endsWith(".") ||
        /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(sandboxId)))
  ) {
    throw new KeyStorageError(`Invalid sandbox ID for key storage: ${JSON.stringify(sandboxId)}`);
  }
  return sandboxId;
}

export function getKeysDir(env: Env = process.env): string {
  return join(getConfigDir(env), "keys");
}

export function getKeyPath(sandboxId: string, env: Env = process.env): string {
  return join(getKeysDir(env), sanitizeSandboxId(sandboxId));
}

/**
 * Saves a sandbox private key with directory mode 0700 and file mode 0600.
 * A missing trailing newline is added, which `ssh` expects.
 */
export async function savePrivateKey(
  sandboxId: string,
  privateKey: string,
  env: Env = process.env,
): Promise<string> {
  const path = getKeyPath(sandboxId, env);
  const trimmed = privateKey.trim();
  if (!trimmed) {
    throw new KeyStorageError("Refusing to save an empty private key.");
  }

  const contents = privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`;
  const configDir = getConfigDir(env);
  const keysDir = getKeysDir(env);
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;

  try {
    await ensurePrivateDir(configDir);
    await ensurePrivateDir(keysDir);
    await writeFile(tmpPath, contents, { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw new KeyStorageError(`Could not save the private key for ${sandboxId}.`, { cause: error });
  }

  return path;
}

/** Returns `null` when no key is stored for the sandbox. */
export async function readPrivateKey(
  sandboxId: string,
  env: Env = process.env,
): Promise<string | null> {
  try {
    return await readFile(getKeyPath(sandboxId, env), "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }
    }
    throw new KeyStorageError(`Could not read the private key for ${sandboxId}.`, { cause: error });
  }
}

export async function privateKeyExists(
  sandboxId: string,
  env: Env = process.env,
): Promise<boolean> {
  return (await readPrivateKey(sandboxId, env)) !== null;
}

export async function deletePrivateKey(sandboxId: string, env: Env = process.env): Promise<void> {
  await rm(getKeyPath(sandboxId, env), { force: true });
}
