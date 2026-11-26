import type { SandboxInfo, TeamQuotaInfo } from "./client.js";

export type UsageLevel = "normal" | "warning" | "error";

/** One usage number, with the quota ratio when a finite limit applies. */
export interface UsageMetric {
  used: number;
  /** Omitted when the quota has no limit for this resource. */
  limit?: number;
  /** `used / limit`; omitted along with `limit`. */
  ratio?: number;
  level: UsageLevel;
}

export interface UsageSummary {
  sandboxes: number;
  running: number;
  cpu: number;
  memoryMB: number;
  diskGB: number;
  /** Null until the snapshot list has loaded once. */
  snapshots: number | null;
  /** Set only for a real team name; `"*"` is not shown. */
  team?: string;
  /** Present only when the server returned a team quota. */
  quota?: {
    sandboxes: UsageMetric;
    cpu: UsageMetric;
    memoryMB: UsageMetric;
  };
}

export interface UsageSummaryInput {
  sandboxes: SandboxInfo[];
  /** Null while the snapshot list has not loaded yet. */
  snapshotCount: number | null;
  team?: string;
  quota?: TeamQuotaInfo | null;
}

const WARNING_RATIO = 0.8;
const ERROR_RATIO = 1;

function metric(used: number, limit: number | undefined): UsageMetric {
  if (limit === undefined || limit <= 0) {
    return { used, level: "normal" };
  }
  const ratio = used / limit;
  return {
    used,
    limit,
    ratio,
    level: ratio >= ERROR_RATIO ? "error" : ratio >= WARNING_RATIO ? "warning" : "normal",
  };
}

/**
 * Sums the loaded sandboxes (excluding destroyed ones) and snapshots, then
 * overlays the server's team quota usage and limits when one is available.
 */
export function summarizeUsage(input: UsageSummaryInput): UsageSummary {
  const live = input.sandboxes.filter((sandbox) => sandbox.status !== "destroyed");
  const sandboxes = live.length;
  const running = live.filter((sandbox) => sandbox.status === "started").length;
  const cpu = live.reduce((total, sandbox) => total + sandbox.cpu, 0);
  const memoryMB = live.reduce((total, sandbox) => total + sandbox.memoryMB, 0);
  const diskGB = live.reduce((total, sandbox) => total + sandbox.diskGB, 0);
  const team = input.team && input.team !== "*" ? input.team : undefined;

  const summary: UsageSummary = {
    sandboxes,
    running,
    cpu,
    memoryMB,
    diskGB,
    snapshots: input.snapshotCount,
    ...(team === undefined ? {} : { team }),
  };

  const quota = input.quota;
  if (!quota) {
    return summary;
  }

  const usedSandboxes = quota.usage?.sandboxes ?? sandboxes;
  const usedCPU = quota.usage?.cpu ?? cpu;
  const usedMemoryMB = quota.usage?.memoryMB ?? memoryMB;
  return {
    ...summary,
    quota: {
      sandboxes: metric(usedSandboxes, quota.maxSandboxes),
      cpu: metric(usedCPU, quota.maxCPU),
      memoryMB: metric(usedMemoryMB, quota.maxMemoryMB),
    },
  };
}
