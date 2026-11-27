import type { NetworkUsageInfo, SetNetworkLimitsInput } from "@lewdev/core";

/** The unit a limit is entered in. `none` saves 0, which means no limit. */
export type LimitUnit = "none" | "MB" | "GB";

export const LIMIT_UNITS: readonly LimitUnit[] = ["none", "MB", "GB"];

export interface LimitValues {
  value: string;
  unit: LimitUnit;
}

export interface NetworkLimitsValues {
  inbound: LimitValues;
  outbound: LimitValues;
}

export type NetworkLimitsFocus = "in-value" | "in-unit" | "out-value" | "out-unit" | "submit";

const MEGABYTE = 1024 * 1024;
const GIGABYTE = 1024 * MEGABYTE;
const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Formats a byte count with binary units and at most one decimal. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = index === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[index]}`;
}

/** A limit's display text; `0` is the API's "unlimited". */
export function formatLimit(limit: number): string {
  return limit <= 0 ? "no limit" : formatBytes(limit);
}

function limitFromBytes(limit: number): LimitValues {
  if (!Number.isFinite(limit) || limit <= 0) {
    return { value: "", unit: "none" };
  }
  const divisor = limit >= GIGABYTE ? GIGABYTE : MEGABYTE;
  const value = Math.max(Math.round((limit / divisor) * 100) / 100, 0.01);
  return { value: String(value), unit: divisor === GIGABYTE ? "GB" : "MB" };
}

export function networkLimitsFromUsage(usage: NetworkUsageInfo): NetworkLimitsValues {
  return {
    inbound: limitFromBytes(usage.bytesInLimit),
    outbound: limitFromBytes(usage.bytesOutLimit),
  };
}

export function limitUnitIndex(unit: LimitUnit): number {
  return LIMIT_UNITS.indexOf(unit);
}

export function moveLimitUnit(unit: LimitUnit, delta: number): LimitUnit {
  const index = limitUnitIndex(unit);
  const base = Math.max(index, 0);
  const next = (base + delta + LIMIT_UNITS.length) % LIMIT_UNITS.length;
  return LIMIT_UNITS[next] ?? "none";
}

function focusOrder(values: NetworkLimitsValues): NetworkLimitsFocus[] {
  const order: NetworkLimitsFocus[] = [];
  if (values.inbound.unit !== "none") {
    order.push("in-value");
  }
  order.push("in-unit");
  if (values.outbound.unit !== "none") {
    order.push("out-value");
  }
  order.push("out-unit", "submit");
  return order;
}

/** Moves between fields, skipping a value box while its unit is No limit. */
export function nextNetworkLimitsFocus(
  values: NetworkLimitsValues,
  current: NetworkLimitsFocus,
  delta: number,
): NetworkLimitsFocus {
  const order = focusOrder(values);
  const index = order.indexOf(current);
  if (index < 0) {
    return order[0] ?? "submit";
  }
  const next = (index + delta + order.length) % order.length;
  return order[next] ?? "submit";
}

/** Accepts digits and one decimal point. */
export function appendLimitChar(value: string, char: string): string {
  if (char === ".") {
    return value.includes(".") ? value : `${value}${char}`;
  }
  return /^\d$/.test(char) ? `${value}${char}` : value;
}

function parseLimit(field: LimitValues, label: string): number {
  if (field.unit === "none") {
    return 0;
  }
  const text = field.value.trim();
  if (!text) {
    throw new Error(`Enter the ${label} limit in ${field.unit}, or choose "No limit".`);
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`The ${label} limit must be a positive number.`);
  }
  const bytes = Math.round(value * (field.unit === "GB" ? GIGABYTE : MEGABYTE));
  if (!Number.isSafeInteger(bytes)) {
    throw new Error(`The ${label} limit is too large.`);
  }
  return bytes;
}

/** Converts the form into the API's byte limits. */
export function networkLimitsInput(values: NetworkLimitsValues): SetNetworkLimitsInput {
  return {
    bytesInLimit: parseLimit(values.inbound, "inbound"),
    bytesOutLimit: parseLimit(values.outbound, "outbound"),
  };
}

/**
 * Explains a cap that is already below current traffic. The server drops
 * traffic once the meter passes a cap and keeps it blocked until the cap is
 * raised, so saving such a limit takes effect immediately.
 */
export function networkLimitWarning(
  values: NetworkLimitsValues,
  usage: NetworkUsageInfo,
): string | null {
  let inbound: number;
  let outbound: number;
  try {
    const input = networkLimitsInput(values);
    inbound = input.bytesInLimit ?? 0;
    outbound = input.bytesOutLimit ?? 0;
  } catch {
    return null;
  }
  const problems: string[] = [];
  if (inbound > 0 && inbound < usage.bytesIn) {
    problems.push(
      `The inbound limit (${formatBytes(inbound)}) is below the ${formatBytes(usage.bytesIn)} already received`,
    );
  }
  if (outbound > 0 && outbound < usage.bytesOut) {
    problems.push(
      `the outbound limit (${formatBytes(outbound)}) is below the ${formatBytes(usage.bytesOut)} already sent`,
    );
  }
  if (problems.length === 0) {
    return null;
  }
  const sentence = problems.join(", and ");
  return `${sentence[0]?.toUpperCase()}${sentence.slice(1)}. The sandbox's traffic is dropped once the meter passes a cap and stays blocked until you raise it. Press enter again to save anyway.`;
}
