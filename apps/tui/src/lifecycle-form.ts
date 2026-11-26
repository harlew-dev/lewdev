import type { SandboxLifecycle, SandboxRuntime } from "@lewdev/core";

import { formatDurationMS, runtimeLabel } from "./format";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface LifecycleChoice {
  id: string;
  label: string;
  ms?: number;
}

export const STOP_IDLE_CHOICES: LifecycleChoice[] = [
  { id: "off", label: "Off" },
  { id: "15m", label: "15m", ms: 15 * MINUTE_MS },
  { id: "30m", label: "30m", ms: 30 * MINUTE_MS },
  { id: "1h", label: "1h", ms: HOUR_MS },
  { id: "2h", label: "2h", ms: 2 * HOUR_MS },
  { id: "4h", label: "4h", ms: 4 * HOUR_MS },
];

export const DELETE_IDLE_CHOICES: LifecycleChoice[] = [
  { id: "off", label: "Off" },
  { id: "1d", label: "1d", ms: DAY_MS },
  { id: "3d", label: "3d", ms: 3 * DAY_MS },
  { id: "7d", label: "7d", ms: 7 * DAY_MS },
  { id: "30d", label: "30d", ms: 30 * DAY_MS },
];

/**
 * The preset choices plus the current value when it came from elsewhere, so
 * opening and saving the page never silently clears a timer.
 */
export function choicesWithCurrent(
  choices: LifecycleChoice[],
  currentMS?: number,
): LifecycleChoice[] {
  if (currentMS === undefined || choices.some((choice) => choice.ms === currentMS)) {
    return choices;
  }
  return [
    ...choices,
    { id: `current-${currentMS}`, label: formatDurationMS(currentMS), ms: currentMS },
  ];
}

export function choiceIdForMS(choices: LifecycleChoice[], ms?: number): string {
  return choices.find((choice) => choice.ms === ms)?.id ?? "off";
}

export function moveLifecycleChoice(
  choices: LifecycleChoice[],
  currentMS: number | undefined,
  delta: number,
): number | undefined {
  const index = choices.findIndex((choice) => choice.ms === currentMS);
  const base = Math.max(index, 0);
  const next = (base + delta + choices.length) % choices.length;
  return choices[next]?.ms;
}

export interface LifecycleFormValues {
  stopIdleMS?: number;
  deleteIdleMS?: number;
  restartOnFailure: boolean;
  serverless: boolean;
  /** Timers this page does not edit, kept because update replaces them all. */
  preserved: SandboxLifecycle;
}

export type LifecycleFocus = "stop-idle" | "delete-idle" | "restart" | "serverless" | "submit";

export function lifecycleFormFromDetails(lifecycle: SandboxLifecycle): LifecycleFormValues {
  return {
    ...(lifecycle.stopIfIdleForMS === undefined ? {} : { stopIdleMS: lifecycle.stopIfIdleForMS }),
    ...(lifecycle.destroyIfIdleForMS === undefined
      ? {}
      : { deleteIdleMS: lifecycle.destroyIfIdleForMS }),
    restartOnFailure: lifecycle.restartOnFailure === true,
    serverless: lifecycle.serverless === true,
    preserved: {
      ...(lifecycle.stopAtAgeMS === undefined ? {} : { stopAtAgeMS: lifecycle.stopAtAgeMS }),
      ...(lifecycle.destroyAtAgeMS === undefined
        ? {}
        : { destroyAtAgeMS: lifecycle.destroyAtAgeMS }),
      ...(lifecycle.destroyAfterExitForMS === undefined
        ? {}
        : { destroyAfterExitForMS: lifecycle.destroyAfterExitForMS }),
    },
  };
}

export function restartOnFailureAllowed(runtime?: SandboxRuntime | ""): boolean {
  return runtime !== "firecracker" && runtime !== "wasm" && runtime !== "isolate";
}

export function restartUnavailableReason(runtime?: SandboxRuntime | ""): string {
  return `Restart on failure is not available for ${runtimeLabel(runtime).toLowerCase()} sandboxes.`;
}

export function nextLifecycleFocus(
  values: LifecycleFormValues,
  runtime: SandboxRuntime | "" | undefined,
  current: LifecycleFocus,
  delta: number,
): LifecycleFocus {
  const order: LifecycleFocus[] = ["stop-idle", "delete-idle"];
  if (restartOnFailureAllowed(runtime)) {
    order.push("restart");
  }
  if (values.stopIdleMS !== undefined) {
    order.push("serverless");
  }
  order.push("submit");
  const index = order.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + order.length) % order.length;
  return order[next] ?? "stop-idle";
}

export function validateLifecycleForm(values: LifecycleFormValues): string | null {
  if (
    values.stopIdleMS !== undefined &&
    values.deleteIdleMS !== undefined &&
    values.deleteIdleMS < values.stopIdleMS
  ) {
    return "Delete when idle must be at least as long as Stop when idle.";
  }
  if (values.serverless && values.stopIdleMS === undefined) {
    return "Wake on HTTP request needs Stop when idle.";
  }
  return null;
}

/** Builds the full replacement payload, keeping timers the page does not edit. */
export function lifecycleUpdateInput(values: LifecycleFormValues): SandboxLifecycle {
  // Update replaces every field, so leaving a flag out turns it off. Sending an
  // explicit false would trip the server's runtime check for restartOnFailure.
  const lifecycle: SandboxLifecycle = { ...values.preserved };
  if (values.serverless) {
    lifecycle.serverless = true;
  }
  if (values.restartOnFailure) {
    lifecycle.restartOnFailure = true;
  }
  if (values.stopIdleMS !== undefined) {
    lifecycle.stopIfIdleForMS = values.stopIdleMS;
  }
  if (values.deleteIdleMS !== undefined) {
    lifecycle.destroyIfIdleForMS = values.deleteIdleMS;
  }
  return lifecycle;
}

/** A short summary for the details page, e.g. "Stops after 30m idle". */
export function describeLifecycle(lifecycle: SandboxLifecycle): string {
  const parts: string[] = [];
  if (lifecycle.stopIfIdleForMS !== undefined) {
    parts.push(`Stops after ${formatDurationMS(lifecycle.stopIfIdleForMS)} idle`);
  }
  if (lifecycle.destroyIfIdleForMS !== undefined) {
    parts.push(`deletes after ${formatDurationMS(lifecycle.destroyIfIdleForMS)} idle`);
  }
  if (lifecycle.stopAtAgeMS !== undefined) {
    parts.push(`stops after ${formatDurationMS(lifecycle.stopAtAgeMS)}`);
  }
  if (lifecycle.destroyAtAgeMS !== undefined) {
    parts.push(`deletes after ${formatDurationMS(lifecycle.destroyAtAgeMS)}`);
  }
  if (lifecycle.destroyAfterExitForMS !== undefined) {
    parts.push(`deletes ${formatDurationMS(lifecycle.destroyAfterExitForMS)} after exit`);
  }
  if (lifecycle.serverless === true) {
    parts.push("wakes on HTTP");
  }
  if (lifecycle.restartOnFailure === true) {
    parts.push("restarts on failure");
  }
  if (parts.length === 0) {
    return "No automatic stop or delete.";
  }
  const sentence = parts.join("; ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
