import type { AuditCoverageInfo, AuditEventInfo } from "@lewdev/core";

export const ALL_AUDIT_KINDS = "all";

export interface AuditKindOption {
  id: string;
  label: string;
}

function timeValue(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

/** Newest first; equal or unparseable times keep their server order. */
export function sortAuditNewest(events: AuditEventInfo[]): AuditEventInfo[] {
  return [...events].sort((a, b) => timeValue(b.time) - timeValue(a.time));
}

/** Adds the kinds in a page to those seen so far, sorted for the filter menu. */
export function mergeAuditKinds(seen: string[], events: AuditEventInfo[]): string[] {
  const kinds = new Set(seen);
  for (const event of events) {
    if (event.kind) {
      kinds.add(event.kind);
    }
  }
  return [...kinds].sort((a, b) => a.localeCompare(b));
}

export function auditKindOptions(kinds: string[]): AuditKindOption[] {
  return [
    { id: ALL_AUDIT_KINDS, label: "All kinds" },
    ...kinds.map((kind) => ({ id: kind, label: kind })),
  ];
}

export function auditFilterLabel(kind: string | null): string {
  return kind === null || kind === ALL_AUDIT_KINDS ? "All kinds" : kind;
}

/** The short destination/reason text shown on an audit row. */
export function auditEventSummary(event: AuditEventInfo): string {
  if (event.destination) {
    return event.destination;
  }
  if (event.reason) {
    return event.reason;
  }
  if (event.ref) {
    return event.ref;
  }
  return "—";
}

/** The selected row's full detail line, including the absolute time. */
export function auditEventDetail(event: AuditEventInfo, absoluteTime: string): string {
  const parts = [absoluteTime, event.kind ?? "unknown kind", event.result];
  if (event.actor) {
    parts.push(`actor ${event.actor}`);
  }
  if (event.destination) {
    parts.push(`destination ${event.destination}`);
  }
  if (event.network) {
    parts.push(`network ${event.network}`);
  }
  if (event.reason) {
    parts.push(`reason ${event.reason}`);
  }
  if (event.dropped !== undefined) {
    parts.push(`${event.dropped} record${event.dropped === 1 ? "" : "s"} dropped`);
  }
  if (event.eventID) {
    parts.push(`event ${event.eventID}`);
  }
  return parts.join(" · ");
}

export function auditCoverageNote(coverage: AuditCoverageInfo): string | null {
  if (!coverage.partial && coverage.missing.length === 0) {
    return null;
  }
  const missing = coverage.missing.length > 0 ? ` Missing: ${coverage.missing.join(", ")}.` : "";
  return `Some nodes did not answer, so this page may be incomplete.${missing}`;
}
