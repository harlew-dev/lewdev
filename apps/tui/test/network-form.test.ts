import { describe, expect, test } from "bun:test";
import type { NetworkUsageInfo } from "@lewdev/core";

import {
  appendLimitChar,
  formatBytes,
  formatLimit,
  moveLimitUnit,
  networkLimitWarning,
  networkLimitsFromUsage,
  networkLimitsInput,
  nextNetworkLimitsFocus,
} from "../src/network-form";

const usage: NetworkUsageInfo = {
  bytesIn: 3 * 1024 * 1024,
  bytesOut: 512 * 1024,
  bytesInLimit: 0,
  bytesOutLimit: 0,
  quotaExceeded: false,
};

function values(inbound: [string, "none" | "MB" | "GB"], outbound: [string, "none" | "MB" | "GB"]) {
  return {
    inbound: { value: inbound[0], unit: inbound[1] },
    outbound: { value: outbound[0], unit: outbound[1] },
  };
}

describe("network usage formatting", () => {
  test("uses binary units and keeps one decimal", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });

  test("shows zero limits as no limit", () => {
    expect(formatLimit(0)).toBe("no limit");
    expect(formatLimit(-1)).toBe("no limit");
    expect(formatLimit(1024 * 1024 * 1024)).toBe("1 GB");
  });
});

describe("network limits form", () => {
  test("fills the form from current limits", () => {
    expect(
      networkLimitsFromUsage({
        ...usage,
        bytesInLimit: 1024 * 1024 * 1024,
        bytesOutLimit: 512 * 1024 * 1024,
      }),
    ).toEqual(values(["1", "GB"], ["512", "MB"]));
    expect(networkLimitsFromUsage(usage)).toEqual(values(["", "none"], ["", "none"]));
  });

  test("skips value fields while a limit is No limit", () => {
    const none = values(["", "none"], ["", "none"]);
    expect(nextNetworkLimitsFocus(none, "in-unit", 1)).toBe("out-unit");
    expect(nextNetworkLimitsFocus(none, "in-unit", -1)).toBe("submit");
    const mb = values(["10", "MB"], ["", "none"]);
    expect(nextNetworkLimitsFocus(mb, "in-unit", -1)).toBe("in-value");
    expect(nextNetworkLimitsFocus(mb, "in-unit", 1)).toBe("out-unit");
  });

  test("cycles units and accepts digits and one decimal point", () => {
    expect(moveLimitUnit("none", 1)).toBe("MB");
    expect(moveLimitUnit("GB", 1)).toBe("none");
    expect(moveLimitUnit("none", -1)).toBe("GB");
    expect(appendLimitChar("", "1")).toBe("1");
    expect(appendLimitChar("1", ".")).toBe("1.");
    expect(appendLimitChar("1.2", ".")).toBe("1.2");
    expect(appendLimitChar("1", "x")).toBe("1");
  });

  test("converts MB and GB into byte limits", () => {
    expect(networkLimitsInput(values(["2", "MB"], ["1", "GB"]))).toEqual({
      bytesInLimit: 2 * 1024 * 1024,
      bytesOutLimit: 1024 * 1024 * 1024,
    });
    expect(networkLimitsInput(values(["", "none"], ["0.5", "GB"]))).toEqual({
      bytesInLimit: 0,
      bytesOutLimit: 512 * 1024 * 1024,
    });
  });

  test("rejects an empty or non-positive limit", () => {
    expect(() => networkLimitsInput(values(["", "MB"], ["1", "GB"]))).toThrow(
      'Enter the inbound limit in MB, or choose "No limit".',
    );
    expect(() => networkLimitsInput(values(["-1", "MB"], ["1", "GB"]))).toThrow(
      "The inbound limit must be a positive number.",
    );
  });

  test("warns when a saved cap is already below current traffic", () => {
    const warning = networkLimitWarning(values(["1", "MB"], ["1", "GB"]), usage);
    expect(warning).toContain("inbound limit (1 MB) is below the 3 MB already received");
    expect(warning).toContain("stays blocked until you raise it");
    expect(warning).toContain("Press enter again to save anyway.");

    expect(networkLimitWarning(values(["4", "MB"], ["1", "GB"]), usage)).toBeNull();
    expect(networkLimitWarning(values(["", "none"], ["", "none"]), usage)).toBeNull();
  });

  test("does not warn for an invalid form", () => {
    expect(networkLimitWarning(values(["", "MB"], ["1", "GB"]), usage)).toBeNull();
  });
});
