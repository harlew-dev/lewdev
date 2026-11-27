import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { remoteBaseName } from "./remote-path.js";

/** The SDK calls file transfers need; `LewdevApi` satisfies this. */
export interface FileTransferApi {
  uploadFileStream(
    id: string,
    targetPath: string,
    data: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
  ): Promise<void>;
  uploadDir(id: string, localDir: string, remoteDir: string): Promise<void>;
  downloadFileStream(id: string, path: string): Promise<ReadableStream<Uint8Array>>;
}

export interface LocalPathOptions {
  home?: string;
  cwd?: string;
  /** Defaults to `process.platform`; tests pass "win32" to check Windows names. */
  platform?: NodeJS.Platform;
}

// Characters Windows refuses in file names. A sandbox can name a file
// `..\..\x` on Linux, and on Windows the backslashes would become separators.
const WINDOWS_UNSAFE = /[<>:"\\|?*]/;

/**
 * Refuses a sandbox file name that would escape the download folder or that
 * the local system cannot store. The name comes from the sandbox, so it is
 * untrusted.
 */
export function assertSafeLocalName(name: string, platform: NodeJS.Platform): void {
  const unsafe =
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    [...name].some((character) => (character.codePointAt(0) ?? 0) < 0x20) ||
    (platform === "win32" && (WINDOWS_UNSAFE.test(name) || /[. ]$/.test(name)));
  if (unsafe) {
    throw new Error(`"${name}" is not a safe local file name. Rename it in the sandbox first.`);
  }
}

/** Expands `~` and `~/…`, then resolves relative paths against the working directory. */
export function expandLocalPath(value: string, options: LocalPathOptions = {}): string {
  const home = options.home ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A local path is required.");
  }
  const expanded =
    trimmed === "~" ? home : trimmed.startsWith("~/") ? join(home, trimmed.slice(2)) : trimmed;
  if (expanded.startsWith("~")) {
    throw new Error("Only ~ and ~/ local paths are supported.");
  }
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
}

/** Shortens a path under the home folder back to `~` for display. */
export function displayLocalPath(path: string, home = homedir()): string {
  if (path === home) {
    return "~";
  }
  const prefix = home.endsWith(sep) ? home : `${home}${sep}`;
  return path.startsWith(prefix) ? `~/${path.slice(prefix.length)}` : path;
}

/** `~/Downloads` when it exists, otherwise the home folder. */
export async function defaultDownloadFolder(home = homedir()): Promise<string> {
  const downloads = join(home, "Downloads");
  try {
    if ((await stat(downloads)).isDirectory()) {
      return downloads;
    }
  } catch {
    // Fall back to the home folder.
  }
  return home;
}

export interface LocalUploadSource {
  kind: "file" | "folder";
  /** The absolute local path. */
  path: string;
  name: string;
  /** Bytes for a file; 0 for a folder. */
  size: number;
}

/** Checks a typed upload path and describes whether it is a file or a folder. */
export async function inspectUploadSource(
  value: string,
  options: LocalPathOptions = {},
): Promise<LocalUploadSource> {
  const path = expandLocalPath(value, options);
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`Local path not found: ${path}`);
    }
    throw error;
  }
  if (info.isDirectory()) {
    const name = basename(path);
    if (!name) {
      throw new Error("Cannot upload a filesystem root.");
    }
    return { kind: "folder", path, name, size: 0 };
  }
  if (info.isFile()) {
    return { kind: "file", path, name: basename(path), size: info.size };
  }
  throw new Error(`Local path is not a file or folder: ${path}`);
}

export async function localPathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** Adds " (1)", " (2)" and so on before the extension until the path is free. */
export async function uniqueLocalPath(path: string): Promise<string> {
  if (!(await localPathExists(path))) {
    return path;
  }
  const folder = dirname(path);
  const extension = extname(path);
  const stem = basename(path, extension);
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = join(folder, `${stem} (${index})${extension}`);
    if (!(await localPathExists(candidate))) {
      return candidate;
    }
  }
  throw new Error(`Could not find a free name for ${path}.`);
}

export interface PreparedDownload {
  /** The absolute destination folder, created when missing. */
  folder: string;
  /** The absolute local file path. */
  localPath: string;
  exists: boolean;
}

/**
 * Expands the destination folder, creates it when missing, and reports whether
 * the local file is already there.
 */
export async function prepareDownloadDestination(
  folderInput: string,
  remotePath: string,
  options: LocalPathOptions = {},
): Promise<PreparedDownload> {
  const name = remoteBaseName(remotePath);
  if (!name || name === "/") {
    throw new Error("Folders cannot be downloaded.");
  }
  assertSafeLocalName(name, options.platform ?? process.platform);
  const folder = expandLocalPath(folderInput, options);
  try {
    if (!(await stat(folder)).isDirectory()) {
      throw new Error(`Not a folder: ${folder}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await mkdir(folder, { recursive: true });
  }
  const localPath = join(folder, name);
  return { folder, localPath, exists: await localPathExists(localPath) };
}

/** Streams a sandbox file into a local path through a temporary file. */
export async function downloadToPath(
  api: FileTransferApi,
  sandboxId: string,
  remotePath: string,
  localPath: string,
): Promise<void> {
  const folder = dirname(localPath);
  await mkdir(folder, { recursive: true });
  const temp = join(
    folder,
    `.${basename(localPath)}.lewdev-${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
  );
  try {
    const stream = await api.downloadFileStream(sandboxId, remotePath);
    await pipeline(
      Readable.from(stream as unknown as AsyncIterable<Uint8Array>),
      createWriteStream(temp, { flags: "wx" }),
    );
    await rm(localPath, { force: true });
    await rename(temp, localPath);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

/** Streams a local file into the sandbox. */
export async function uploadFileFromPath(
  api: FileTransferApi,
  sandboxId: string,
  localPath: string,
  remotePath: string,
): Promise<void> {
  await api.uploadFileStream(
    sandboxId,
    remotePath,
    createReadStream(localPath) as AsyncIterable<Uint8Array>,
  );
}

/**
 * Copies a local folder's contents into a sandbox folder. Callers usually pass
 * `<parent>/<folder-name>` so the folder itself appears, like `cp -r`.
 */
export async function uploadFolderFromPath(
  api: FileTransferApi,
  sandboxId: string,
  localFolder: string,
  remoteDir: string,
): Promise<void> {
  await api.uploadDir(sandboxId, localFolder, remoteDir);
}
