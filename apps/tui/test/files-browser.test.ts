import { describe, expect, test } from "bun:test";

import {
  describeSearchError,
  nameSearchPattern,
  clampFilesSelection,
  filesConflictOptions,
  filesHints,
  filesPathForInput,
  filesTextInputActive,
  filesUploadTarget,
  filterFileEntries,
  formatFileSize,
  formatFileTime,
  initialFilesState,
  moveFilesSelection,
  searchResultLabel,
  sortFileEntries,
  visibleFileEntries,
} from "../src/files-browser";

const entry = (name: string, isDir = false) => ({
  name,
  path: `/root/${name}`,
  isDir,
});

describe("file listing", () => {
  test("puts folders first and sorts names case-insensitively", () => {
    const sorted = sortFileEntries([
      entry("zebra.txt"),
      entry("alpha"),
      entry("Beta"),
      entry("apple.txt"),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["alpha", "apple.txt", "Beta", "zebra.txt"]);
  });

  test("filters by name and keeps folder-first order", () => {
    const entries = [entry("notes.md"), entry("logs", true), entry("old-logs", true)];
    expect(filterFileEntries(entries, "LOG").map((item) => item.name)).toEqual([
      "logs",
      "old-logs",
    ]);
    expect(filterFileEntries(entries, "").map((item) => item.name)).toEqual([
      "notes.md",
      "logs",
      "old-logs",
    ]);
    expect(visibleFileEntries(entries, "log").map((item) => item.name)).toEqual([
      "logs",
      "old-logs",
    ]);
  });

  test("clamps and moves the selection without wrapping", () => {
    expect(clampFilesSelection(4, 3)).toBe(2);
    expect(clampFilesSelection(-1, 3)).toBe(0);
    expect(clampFilesSelection(2, 0)).toBe(0);
    expect(moveFilesSelection(0, -1, 3)).toBe(0);
    expect(moveFilesSelection(2, 1, 3)).toBe(2);
    expect(moveFilesSelection(1, 1, 3)).toBe(2);
  });
});

describe("paths", () => {
  test("builds upload targets under the current folder", () => {
    expect(filesUploadTarget("/root", "notes.txt")).toBe("/root/notes.txt");
    expect(filesUploadTarget("/root/", "project")).toBe("/root/project");
  });

  test("resolves typed paths, including ~", () => {
    expect(filesPathForInput("/root/work", "notes.txt")).toBe("/root/work/notes.txt");
    expect(filesPathForInput("/root/work", "~/logs")).toBe("/root/logs");
    expect(filesPathForInput("/root/work", "/tmp")).toBe("/tmp");
  });
});

describe("prompt state", () => {
  test("treats prompt modes and an active filter as text input", () => {
    const state = initialFilesState();
    expect(filesTextInputActive(state)).toBe(false);
    expect(filesTextInputActive({ ...state, filterEditing: true })).toBe(true);
    for (const mode of ["path", "upload", "download", "rename", "mkdir", "search"] as const) {
      expect(filesTextInputActive({ ...state, mode })).toBe(true);
    }
    for (const mode of ["browse", "delete", "conflict", "search-results"] as const) {
      expect(filesTextInputActive({ ...state, mode })).toBe(false);
    }
  });

  test("offers three download choices and two for uploads and moves", () => {
    expect(
      filesConflictOptions({
        kind: "download",
        remotePath: "/root/a.txt",
        folder: "/tmp",
        localPath: "/tmp/a.txt",
      }).map((option) => option.id),
    ).toEqual(["keep-both", "overwrite", "cancel"]);
    expect(
      filesConflictOptions({
        kind: "upload",
        localPath: "/tmp/a.txt",
        remotePath: "/root/a.txt",
        isDir: false,
      }).map((option) => option.id),
    ).toEqual(["cancel", "overwrite"]);
    expect(
      filesConflictOptions({
        kind: "rename",
        source: "/root/a.txt",
        destination: "/root/b.txt",
      }).map((option) => option.id),
    ).toEqual(["cancel", "overwrite"]);
  });

  test("lists shortcuts for each mode and never uses j or k as actions", () => {
    const state = initialFilesState();
    const keys = filesHints(state).map(([key]) => key);
    expect(keys).toContain("enter");
    expect(keys).toContain("u");
    expect(keys).toContain("d");
    expect(keys).not.toContain("j");
    expect(keys).not.toContain("k");
    expect(filesHints({ ...state, mode: "delete" }).map(([key]) => key)).toEqual(["enter", "esc"]);
    expect(filesHints({ ...state, mode: "search" }).map(([key]) => key)).toEqual([
      "enter",
      "tab",
      "esc",
    ]);
  });
});

describe("formatting", () => {
  test("formats sizes and missing metadata", () => {
    expect(formatFileSize(undefined)).toBe("—");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatFileTime(undefined)).toBe("—");
  });

  test("labels text results with their line", () => {
    expect(searchResultLabel({ path: "/root/a.txt" })).toBe("/root/a.txt");
    expect(searchResultLabel({ path: "/root/a.txt", line: 4 })).toBe("/root/a.txt:4");
  });
});

describe("nameSearchPattern", () => {
  test("plain text matches names that contain it", () => {
    expect(nameSearchPattern("report")).toBe("*report*");
    expect(nameSearchPattern("  lw-upload ")).toBe("*lw-upload*");
  });

  test("globs are used as typed", () => {
    expect(nameSearchPattern("*.ts")).toBe("*.ts");
    expect(nameSearchPattern("file?.txt")).toBe("file?.txt");
    expect(nameSearchPattern("[ab].md")).toBe("[ab].md");
  });
});

describe("describeSearchError", () => {
  test("rewords the server's long-line failure", () => {
    expect(
      describeSearchError(new Error("Request failed (HTTP 500): bufio.Scanner: token too long")),
    ).toContain("very long lines");
  });
});
