import type { SandboxInfo, SnapshotInfo } from "@lewdev/core";

import { runtimeLabel, sandboxLabel, shortId, shortStatus } from "./format";

/** Sort orders offered on the Sandboxes tab. */
export type SortMode = "newest" | "name" | "status";
/** Snapshots have no status, so they only offer two sort orders. */
export type SnapshotSortMode = "newest" | "name";

export const SANDBOX_SORT_MODES: readonly SortMode[] = ["newest", "name", "status"];
export const SNAPSHOT_SORT_MODES: readonly SnapshotSortMode[] = ["newest", "name"];

/** Cycles to the next sort mode, wrapping back to the first. */
export function nextSortMode<T extends string>(current: T, modes: readonly T[]): T {
  if (modes.length === 0) {
    return current;
  }
  const index = modes.indexOf(current);
  return modes[(index + 1) % modes.length] ?? current;
}

/** Short label shown next to the panel title. */
export function sortLabel(mode: SortMode): string {
  switch (mode) {
    case "name":
      return "name A→Z";
    case "status":
      return "running first";
    default:
      return "newest first";
  }
}

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** Everything a sandbox row displays, so users can filter by any visible value. */
function sandboxSearchText(sandbox: SandboxInfo): string {
  return [
    sandboxLabel(sandbox),
    shortId(sandbox.id),
    sandbox.id,
    sandbox.image,
    shortStatus(sandbox.status),
    runtimeLabel(sandbox.runtime),
  ]
    .join("\n")
    .toLocaleLowerCase();
}

/**
 * Case-insensitive substring filter over the values a sandbox row shows: name,
 * ID, image, status label and runtime label. An empty query keeps every row.
 */
export function filterSandboxes(sandboxes: readonly SandboxInfo[], query: string): SandboxInfo[] {
  const needle = normalizeQuery(query);
  if (!needle) {
    return [...sandboxes];
  }
  return sandboxes.filter((sandbox) => sandboxSearchText(sandbox).includes(needle));
}

/** Case-insensitive substring filter over the values a snapshot row shows. */
export function filterSnapshots(snapshots: readonly SnapshotInfo[], query: string): SnapshotInfo[] {
  const needle = normalizeQuery(query);
  if (!needle) {
    return [...snapshots];
  }
  return snapshots.filter((snapshot) =>
    [snapshot.name, snapshot.image, snapshot.imageID ?? ""]
      .join("\n")
      .toLocaleLowerCase()
      .includes(needle),
  );
}

function timestamp(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function compareNames(a: string, b: string): number {
  const primary = a.localeCompare(b, undefined, { sensitivity: "base" });
  return primary !== 0 ? primary : a.localeCompare(b);
}

/** Running sandboxes first, then in-progress states, then stopped ones. */
const STATUS_RANK: Record<string, number> = {
  started: 0,
  creating: 1,
  awaiting_runtime: 2,
  stopped: 3,
  passivated: 4,
  error: 5,
  destroyed: 6,
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 99;
}

function compareSandboxesByStatus(a: SandboxInfo, b: SandboxInfo): number {
  const rank = statusRank(a.status) - statusRank(b.status);
  return rank !== 0 ? rank : timestamp(b.createdAt) - timestamp(a.createdAt);
}

/** Returns a sorted copy; the caller's list is never mutated. */
export function sortSandboxes(sandboxes: readonly SandboxInfo[], mode: SortMode): SandboxInfo[] {
  const sorted = [...sandboxes];
  switch (mode) {
    case "name":
      return sorted.sort((a, b) => compareNames(sandboxLabel(a), sandboxLabel(b)));
    case "status":
      return sorted.sort(compareSandboxesByStatus);
    default:
      return sorted.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }
}

/** Returns a sorted copy; the caller's list is never mutated. */
export function sortSnapshots(
  snapshots: readonly SnapshotInfo[],
  mode: SnapshotSortMode,
): SnapshotInfo[] {
  const sorted = [...snapshots];
  switch (mode) {
    case "name":
      return sorted.sort((a, b) => compareNames(a.name, b.name));
    default:
      return sorted.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }
}
