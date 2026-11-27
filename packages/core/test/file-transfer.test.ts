import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertSafeLocalName,
  defaultDownloadFolder,
  displayLocalPath,
  downloadToPath,
  expandLocalPath,
  inspectUploadSource,
  prepareDownloadDestination,
  uniqueLocalPath,
  uploadFileFromPath,
  uploadFolderFromPath,
  type FileTransferApi,
} from "../src/index.js";

let root: string;
let home: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lewdev-files-"));
  home = join(root, "home");
  await mkdir(home);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Response(bytes).body as ReadableStream<Uint8Array>;
}

describe("local paths", () => {
  test("expands ~ and resolves relative paths", () => {
    expect(expandLocalPath("~/Downloads", { home })).toBe(join(home, "Downloads"));
    expect(expandLocalPath("~", { home })).toBe(home);
    expect(expandLocalPath("./file.txt", { home, cwd: root })).toBe(join(root, "file.txt"));
    expect(displayLocalPath(join(home, "Downloads"), home)).toBe("~/Downloads");
    expect(displayLocalPath(join(root, "elsewhere"), home)).toBe(join(root, "elsewhere"));
  });

  test("rejects an empty path and another user's home", () => {
    expect(() => expandLocalPath("  ", { home })).toThrow("A local path is required.");
    expect(() => expandLocalPath("~other/file", { home })).toThrow("Only ~ and ~/");
  });

  test("prefers ~/Downloads and falls back to home", async () => {
    expect(await defaultDownloadFolder(home)).toBe(home);
    await mkdir(join(home, "Downloads"));
    expect(await defaultDownloadFolder(home)).toBe(join(home, "Downloads"));
  });
});

describe("upload sources", () => {
  test("describes files and folders", async () => {
    const file = join(root, "notes.txt");
    await writeFile(file, "hello");
    const folder = join(root, "project");
    await mkdir(folder);

    expect(await inspectUploadSource(file)).toMatchObject({
      kind: "file",
      path: file,
      name: "notes.txt",
      size: 5,
    });
    expect(await inspectUploadSource(folder)).toMatchObject({
      kind: "folder",
      path: folder,
      name: "project",
      size: 0,
    });
    await expect(inspectUploadSource(join(root, "missing.txt"))).rejects.toThrow(
      "Local path not found",
    );
    await expect(inspectUploadSource("/")).rejects.toThrow("Cannot upload a filesystem root.");
  });
});

describe("download destinations", () => {
  test("creates the folder and reports an existing file", async () => {
    const folder = join(root, "downloads");
    const prepared = await prepareDownloadDestination(folder, "/root/notes.txt");
    expect(prepared).toEqual({
      folder,
      localPath: join(folder, "notes.txt"),
      exists: false,
    });
    await writeFile(prepared.localPath, "old");
    await expect(prepareDownloadDestination(folder, "/root/notes.txt")).resolves.toMatchObject({
      exists: true,
    });
  });

  test("refuses to use a folder as a file name", async () => {
    await expect(prepareDownloadDestination(root, "/")).rejects.toThrow(
      "Folders cannot be downloaded.",
    );
  });

  test("refuses a destination that is a file", async () => {
    const file = join(root, "not-a-folder");
    await writeFile(file, "x");
    await expect(prepareDownloadDestination(file, "/root/a.txt")).rejects.toThrow("Not a folder");
  });

  test("adds a suffix until a local name is free", async () => {
    const path = join(root, "notes.txt");
    await writeFile(path, "one");
    expect(await uniqueLocalPath(path)).toBe(join(root, "notes (1).txt"));
    await writeFile(join(root, "notes (1).txt"), "two");
    expect(await uniqueLocalPath(path)).toBe(join(root, "notes (2).txt"));
  });
});

describe("streamed transfers", () => {
  test("writes a download and replaces the old file", async () => {
    const local = join(root, "nested", "notes.txt");
    await mkdir(join(root, "nested"));
    await writeFile(local, "old");
    const api: FileTransferApi = {
      uploadFileStream: async () => {},
      uploadDir: async () => {},
      downloadFileStream: async () => streamOf(new TextEncoder().encode("new contents")),
    };

    await downloadToPath(api, "sb-1", "/root/notes.txt", local);
    expect(await readFile(local, "utf8")).toBe("new contents");
    expect((await readdir(join(root, "nested"))).filter((name) => name.startsWith("."))).toEqual(
      [],
    );
  });

  test("leaves no partial file when a download fails", async () => {
    const local = join(root, "notes.txt");
    const api: FileTransferApi = {
      uploadFileStream: async () => {},
      uploadDir: async () => {},
      downloadFileStream: async () => {
        throw new Error("network down");
      },
    };

    await expect(downloadToPath(api, "sb-1", "/root/notes.txt", local)).rejects.toThrow(
      "network down",
    );
    await expect(readFile(local, "utf8")).rejects.toThrow();
  });

  test("uploads a file as a stream and a folder through uploadDir", async () => {
    const local = join(root, "notes.txt");
    await writeFile(local, "hello");
    const chunks: string[] = [];
    const folders: string[][] = [];
    const api: FileTransferApi = {
      uploadFileStream: async (_id, remotePath, data) => {
        const parts: number[] = [];
        for await (const chunk of data as AsyncIterable<Uint8Array>) {
          parts.push(...chunk);
        }
        chunks.push(`${remotePath}:${new TextDecoder().decode(new Uint8Array(parts))}`);
      },
      uploadDir: async (id, localDir, remoteDir) => {
        folders.push([id, localDir, remoteDir]);
      },
      downloadFileStream: async () => streamOf(new Uint8Array()),
    };

    await uploadFileFromPath(api, "sb-1", local, "/root/notes.txt");
    await uploadFolderFromPath(api, "sb-1", root, "/root/project");
    expect(chunks).toEqual(["/root/notes.txt:hello"]);
    expect(folders).toEqual([["sb-1", root, "/root/project"]]);
  });
});

describe("assertSafeLocalName", () => {
  test("accepts ordinary names", () => {
    expect(() => assertSafeLocalName("report (final).txt", "linux")).not.toThrow();
    expect(() => assertSafeLocalName("report.txt", "win32")).not.toThrow();
  });

  test("refuses names that would leave the download folder", () => {
    expect(() => assertSafeLocalName("..", "linux")).toThrow();
    expect(() => assertSafeLocalName(".", "darwin")).toThrow();
    expect(() => assertSafeLocalName("..\\..\\evil.exe", "win32")).toThrow();
  });

  test("refuses names Windows cannot store", () => {
    expect(() => assertSafeLocalName("a:b", "win32")).toThrow();
    expect(() => assertSafeLocalName("trailing.", "win32")).toThrow();
    expect(() => assertSafeLocalName("a:b", "linux")).not.toThrow();
  });
});
