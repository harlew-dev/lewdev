import { describe, expect, test } from "bun:test";
import type { SandboxInfo } from "../src/index.js";
import { summarizeUsage } from "../src/index.js";

const createdAt = "2026-11-25T10:00:00Z";

function sandbox(overrides: Partial<SandboxInfo>): SandboxInfo {
  return {
    id: "sb-1",
    image: "ubuntu:24.04",
    status: "started",
    cpu: 2,
    memoryMB: 2048,
    diskGB: 10,
    createdAt,
    publicURL: "https://sb.example.com",
    exposedPorts: [],
    ...overrides,
  };
}

describe("summarizeUsage", () => {
  test("sums live sandboxes and counts running ones", () => {
    const summary = summarizeUsage({
      sandboxes: [
        sandbox({ id: "sb-1", status: "started", cpu: 2, memoryMB: 2048, diskGB: 10 }),
        sandbox({ id: "sb-2", status: "stopped", cpu: 1, memoryMB: 1024, diskGB: 20 }),
        sandbox({ id: "sb-3", status: "destroyed", cpu: 8, memoryMB: 8192, diskGB: 80 }),
      ],
      snapshotCount: 4,
      team: "acme",
    });

    expect(summary).toEqual({
      sandboxes: 2,
      running: 1,
      cpu: 3,
      memoryMB: 3072,
      diskGB: 30,
      snapshots: 4,
      team: "acme",
    });
  });

  test("hides the wildcard team", () => {
    const summary = summarizeUsage({ sandboxes: [], snapshotCount: 0, team: "*" });
    expect(summary.team).toBeUndefined();
  });

  test("keeps the snapshot count unknown until the list has loaded", () => {
    const summary = summarizeUsage({ sandboxes: [], snapshotCount: null });
    expect(summary.snapshots).toBeNull();
  });

  test("shows quota usage and limits with ratios", () => {
    const summary = summarizeUsage({
      sandboxes: [sandbox({})],
      snapshotCount: 2,
      quota: {
        team: "acme",
        maxSandboxes: 10,
        maxCPU: 8,
        maxMemoryMB: 16384,
        usage: { sandboxes: 3, cpu: 7, memoryMB: 3072 },
      },
    });

    expect(summary.quota).toEqual({
      sandboxes: { used: 3, limit: 10, ratio: 0.3, level: "normal" },
      cpu: { used: 7, limit: 8, ratio: 0.875, level: "warning" },
      memoryMB: { used: 3072, limit: 16384, ratio: 0.1875, level: "normal" },
    });
  });

  test("marks a reached limit as an error", () => {
    const summary = summarizeUsage({
      sandboxes: [],
      snapshotCount: 0,
      quota: {
        team: "acme",
        maxSandboxes: 10,
        usage: { sandboxes: 10, cpu: 0, memoryMB: 0 },
      },
    });
    expect(summary.quota?.sandboxes.level).toBe("error");
  });

  test("treats zero or absent limits as unlimited and falls back to local usage", () => {
    const summary = summarizeUsage({
      sandboxes: [sandbox({ cpu: 2, memoryMB: 2048 })],
      snapshotCount: 0,
      quota: { team: "acme", maxSandboxes: 0, maxCPU: 8 },
    });

    expect(summary.quota?.sandboxes).toEqual({ used: 1, level: "normal" });
    expect(summary.quota?.cpu).toEqual({ used: 2, limit: 8, ratio: 0.25, level: "normal" });
    expect(summary.quota?.memoryMB).toEqual({ used: 2048, level: "normal" });
  });
});
