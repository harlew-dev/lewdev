import { describe, expect, test } from "bun:test";

import {
  completeRemotePath,
  isHiddenRemoteName,
  joinRemotePath,
  normalizeRemotePath,
  parentRemotePath,
  remoteBaseName,
  remotePathForUrl,
  resolveRemotePath,
} from "../src/index.js";

describe("remote paths", () => {
  test("normalizes repeated slashes, dots and parent segments", () => {
    expect(normalizeRemotePath("//root///a/./b/../c")).toBe("/root/a/c");
    expect(normalizeRemotePath("/../../etc")).toBe("/etc");
    expect(normalizeRemotePath("relative")).toBe("/relative");
    expect(normalizeRemotePath("C:\\root\\a")).toBe("/C:/root/a");
  });

  test("resolves absolute, relative and home paths", () => {
    expect(resolveRemotePath("/root", "work")).toBe("/root/work");
    expect(resolveRemotePath("/root/work", "../logs")).toBe("/root/logs");
    expect(resolveRemotePath("/root", "~")).toBe("/root");
    expect(resolveRemotePath("/", "~/code/app")).toBe("/root/code/app");
    expect(resolveRemotePath("/root", "/etc")).toBe("/etc");
    expect(resolveRemotePath("/root", "")).toBe("/root");
  });

  test("navigates parents and joins folders", () => {
    expect(parentRemotePath("/")).toBe("/");
    expect(parentRemotePath("/root")).toBe("/");
    expect(parentRemotePath("/root/a/b")).toBe("/root/a");
    expect(joinRemotePath("/root", "app")).toBe("/root/app");
    expect(joinRemotePath("/root/app", "..")).toBe("/root");
    expect(remoteBaseName("/root/app")).toBe("app");
    expect(remoteBaseName("/")).toBe("/");
  });

  test("completes the last segment and ignores hidden names on request", () => {
    const names = ["Documents", "Downloads", "dev"];
    expect(completeRemotePath("Doc", names)).toBe("Documents");
    expect(completeRemotePath("Do", names)).toBe("Do");
    expect(completeRemotePath("/root/Down", names)).toBe("/root/Downloads");
    expect(completeRemotePath("missing", names)).toBe("missing");
    expect(isHiddenRemoteName(".cache")).toBe(true);
    expect(isHiddenRemoteName("cache")).toBe(false);
    expect(isHiddenRemoteName("..")).toBe(false);
  });

  test("encodes a path for the vscode URL", () => {
    expect(remotePathForUrl("/root/my app/a#b")).toBe("/root/my%20app/a%23b");
  });
});
