import { describe, expect, test } from "bun:test";
import type { AuditEventInfo } from "@lewdev/core";

import {
  ALL_AUDIT_KINDS,
  auditCoverageNote,
  auditEventDetail,
  auditEventSummary,
  auditFilterLabel,
  auditKindOptions,
  mergeAuditKinds,
  sortAuditNewest,
} from "../src/audit-view";

function event(overrides: Partial<AuditEventInfo> = {}): AuditEventInfo {
  return {
    time: "2026-11-27T10:00:00Z",
    result: "success",
    ...overrides,
  };
}

describe("audit log view", () => {
  test("sorts newest first and tolerates unparseable times", () => {
    const sorted = sortAuditNewest([
      event({ time: "2026-11-27T10:00:00Z" }),
      event({ time: "not a time", eventID: "bad" }),
      event({ time: "2026-11-27T11:00:00Z" }),
    ]);

    expect(sorted.map((entry) => entry.time)).toEqual([
      "2026-11-27T11:00:00Z",
      "2026-11-27T10:00:00Z",
      "not a time",
    ]);
  });

  test("merges each page's kinds into a sorted unique list", () => {
    const seen = mergeAuditKinds([], [event({ kind: "egress" }), event({ kind: "secret" })]);
    expect(seen).toEqual(["egress", "secret"]);
    expect(
      mergeAuditKinds(seen, [event({ kind: "secret" }), event(), event({ kind: "auth" })]),
    ).toEqual(["auth", "egress", "secret"]);
  });

  test("offers All kinds plus the kinds seen so far", () => {
    expect(auditKindOptions(["egress", "secret"])).toEqual([
      { id: ALL_AUDIT_KINDS, label: "All kinds" },
      { id: "egress", label: "egress" },
      { id: "secret", label: "secret" },
    ]);
    expect(auditFilterLabel(null)).toBe("All kinds");
    expect(auditFilterLabel("egress")).toBe("egress");
  });

  test("summarises a row by destination, reason or ref", () => {
    expect(
      auditEventSummary(event({ destination: "example.com:443", reason: "host_not_allowed" })),
    ).toBe("example.com:443");
    expect(auditEventSummary(event({ reason: "host_not_allowed" }))).toBe("host_not_allowed");
    expect(auditEventSummary(event({ ref: "ref-1" }))).toBe("ref-1");
    expect(auditEventSummary(event())).toBe("—");
  });

  test("builds the selected row's full detail line", () => {
    const detail = auditEventDetail(
      event({
        kind: "egress",
        result: "failure",
        actor: "system:lifecycle",
        destination: "example.com:443",
        network: "tcp",
        reason: "host_not_allowed",
        dropped: 2,
        eventID: "evt-1",
      }),
      "Nov 27, 2026, 10:00",
    );

    expect(detail).toContain("Nov 27, 2026, 10:00");
    expect(detail).toContain("egress");
    expect(detail).toContain("failure");
    expect(detail).toContain("actor system:lifecycle");
    expect(detail).toContain("destination example.com:443");
    expect(detail).toContain("reason host_not_allowed");
    expect(detail).toContain("2 records dropped");
    expect(detail).toContain("event evt-1");
  });

  test("notes incomplete coverage and missing nodes", () => {
    expect(auditCoverageNote({ answered: ["a"], missing: [], partial: false })).toBeNull();
    expect(auditCoverageNote({ answered: ["a"], missing: ["b"], partial: true })).toContain(
      "Missing: b.",
    );
  });
});
