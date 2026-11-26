import { describe, expect, test } from "bun:test";

import { resolveSandbox, SandboxResolutionError } from "../src/sandbox-resolve.js";

const sandboxes = [
  { id: "sb-aaa", name: "web" },
  { id: "sb-bbb", name: "web" },
  { id: "sb-ccc", name: "api" },
  { id: "sb-ddd" },
  { id: "sb-eee", name: "sb-aaa" },
];

describe("resolveSandbox", () => {
  test("prefers an exact ID over a matching name", () => {
    expect(resolveSandbox(sandboxes, "sb-aaa").id).toBe("sb-aaa");
  });

  test("resolves a unique exact name", () => {
    expect(resolveSandbox(sandboxes, "api").id).toBe("sb-ccc");
  });

  test("reports every ID when a name is ambiguous", () => {
    expect(() => resolveSandbox(sandboxes, "web")).toThrow(SandboxResolutionError);
    expect(() => resolveSandbox(sandboxes, "web")).toThrow("sb-aaa, sb-bbb");
  });

  test("reports an unknown reference", () => {
    expect(() => resolveSandbox(sandboxes, "missing")).toThrow("No sandbox matches");
  });

  test("does not match an unnamed sandbox with an empty query", () => {
    expect(() => resolveSandbox(sandboxes, "")).toThrow("No sandbox matches");
  });
});
