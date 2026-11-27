import { describe, expect, test } from "bun:test";
import { MicroVMApiError } from "@aerol-ai/aerolvm-sdk";

import { describeError, describeFileError, isFileAccessUnsupportedError } from "../src/index.js";

describe("describeError", () => {
  test("explains a full team quota on 429", () => {
    const error = new MicroVMApiError(429, "quota exceeded", { code: "team_quota_exceeded" });
    expect(describeError(error)).toBe(
      "The team quota is full. Delete a sandbox or ask an admin to raise the quota.",
    );
  });

  test("explains rate limiting on 429", () => {
    const error = new MicroVMApiError(429, "slow down", { code: "rate_limited" });
    expect(describeError(error)).toBe("Too many requests. Wait a moment and try again.");
  });

  test("keeps the generic HTTP detail for other API errors", () => {
    const error = new MicroVMApiError(404, "not found", { code: "missing" });
    expect(describeError(error)).toContain("HTTP 404");
    expect(describeError(error)).toContain("missing");
  });

  test("explains a missing file toolbox as unsupported file access", () => {
    const error = new MicroVMApiError(501, "not implemented");
    expect(isFileAccessUnsupportedError(error)).toBe(true);
    expect(describeFileError(error)).toBe("This sandbox's runtime doesn't support file access.");
    expect(describeFileError(new Error("other"))).toBe("other");
  });
});
