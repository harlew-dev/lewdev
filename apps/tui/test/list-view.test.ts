import { describe, expect, test } from "bun:test";

import type { SandboxInfo, SnapshotInfo } from "@lewdev/core";

import {
  filterSandboxes,
  filterSnapshots,
  nextSortMode,
  SANDBOX_SORT_MODES,
  SNAPSHOT_SORT_MODES,
  sortLabel,
  sortSandboxes,
  sortSnapshots,
} from "../src/list-view";

function sandbox(overrides: Partial<SandboxInfo> & { id: string }): SandboxInfo {
  return {
    name: undefined,
    image: "ubuntu:24.04",
    status: "stopped",
    cpu: 1,
    memoryMB: 1024,
    diskGB: 10,
    createdAt: "2026-01-01T00:00:00Z",
    publicURL: "",
    exposedPorts: [],
    ...overrides,
  } as SandboxInfo;
}

function snapshot(overrides: Partial<SnapshotInfo> & { name: string }): SnapshotInfo {
  return {
    image: "ubuntu:24.04",
    sourceSandboxID: "sb-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const alpha = sandbox({
  id: "sb-alpha",
  name: "Alpha",
  image: "ubuntu:22.04",
  status: "started",
  runtime: "docker",
  createdAt: "2026-01-01T00:00:00Z",
});
const beta = sandbox({
  id: "sb-beta",
  name: "Beta",
  image: "alpine:3.20",
  status: "stopped",
  createdAt: "2026-02-01T00:00:00Z",
});
const gamma = sandbox({
  id: "sb-gamma",
  name: "Gamma",
  image: "debian:12",
  status: "creating",
  runtime: "gvisor",
  createdAt: "2026-03-01T00:00:00Z",
});

describe("sort modes", () => {
  test("cycles sandboxes through newest, name and status", () => {
    let mode = SANDBOX_SORT_MODES[0];
    if (mode === undefined) {
      throw new Error("missing sort modes");
    }
    const seen = [mode];
    for (let index = 0; index < SANDBOX_SORT_MODES.length; index += 1) {
      mode = nextSortMode(mode, SANDBOX_SORT_MODES);
      seen.push(mode);
    }
    expect(seen).toEqual(["newest", "name", "status", "newest"]);
  });

  test("cycles snapshots through newest and name only", () => {
    let mode = SNAPSHOT_SORT_MODES[0];
    if (mode === undefined) {
      throw new Error("missing sort modes");
    }
    const seen = [mode];
    for (let index = 0; index < SNAPSHOT_SORT_MODES.length; index += 1) {
      mode = nextSortMode(mode, SNAPSHOT_SORT_MODES);
      seen.push(mode);
    }
    expect(seen).toEqual(["newest", "name", "newest"]);
  });

  test("labels every mode", () => {
    expect(sortLabel("newest")).toBe("newest first");
    expect(sortLabel("name")).toBe("name A→Z");
    expect(sortLabel("status")).toBe("running first");
  });
});

describe("sandbox filtering", () => {
  const items = [alpha, beta, gamma];

  test("keeps every row for an empty or whitespace query", () => {
    expect(filterSandboxes(items, "")).toEqual(items);
    expect(filterSandboxes(items, "   ")).toEqual(items);
  });

  test("matches the displayed name and image case-insensitively", () => {
    expect(filterSandboxes(items, "alph")).toEqual([alpha]);
    expect(filterSandboxes(items, "ALPINE")).toEqual([beta]);
  });

  test("matches the sandbox ID and short ID", () => {
    expect(filterSandboxes(items, "sb-gamma")).toEqual([gamma]);
    expect(filterSandboxes(items, "sb-beta")).toEqual([beta]);
  });

  test("matches the displayed status and runtime labels", () => {
    expect(filterSandboxes(items, "running")).toEqual([alpha]);
    expect(filterSandboxes(items, "creating")).toEqual([gamma]);
    expect(filterSandboxes(items, "docker")).toEqual([alpha]);
    expect(filterSandboxes(items, "gvisor")).toEqual([gamma]);
  });

  test("returns an empty list when nothing matches", () => {
    expect(filterSandboxes(items, "no-such-box")).toEqual([]);
  });
});

describe("snapshot filtering", () => {
  const items = [
    snapshot({ name: "base", image: "ubuntu:24.04", imageID: "img-abc" }),
    snapshot({ name: "nightly", image: "alpine:3.20" }),
  ];

  test("matches name, image and image ID case-insensitively", () => {
    expect(filterSnapshots(items, "BASE")).toEqual([items[0] as SnapshotInfo]);
    expect(filterSnapshots(items, "alpine")).toEqual([items[1] as SnapshotInfo]);
    expect(filterSnapshots(items, "IMG-ABC")).toEqual([items[0] as SnapshotInfo]);
  });

  test("keeps every row for an empty query", () => {
    expect(filterSnapshots(items, "")).toEqual(items);
  });
});

describe("sorting", () => {
  const items = [alpha, beta, gamma];

  test("sorts sandboxes newest first by default", () => {
    expect(sortSandboxes(items, "newest").map((item) => item.id)).toEqual([
      "sb-gamma",
      "sb-beta",
      "sb-alpha",
    ]);
  });

  test("sorts sandboxes by name A to Z", () => {
    expect(sortSandboxes(items, "name").map((item) => item.name)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  test("sorts sandboxes with running first", () => {
    expect(sortSandboxes(items, "status").map((item) => item.status)).toEqual([
      "started",
      "creating",
      "stopped",
    ]);
  });

  test("sorts snapshots newest first or by name", () => {
    const snapshots = [
      snapshot({ name: "old", createdAt: "2026-01-01T00:00:00Z" }),
      snapshot({ name: "new", createdAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(sortSnapshots(snapshots, "newest").map((item) => item.name)).toEqual(["new", "old"]);
    expect(sortSnapshots(snapshots, "name").map((item) => item.name)).toEqual(["new", "old"]);
  });

  test("never mutates the caller's list", () => {
    const original = [...items];
    sortSandboxes(items, "name");
    expect(items).toEqual(original);
  });
});
