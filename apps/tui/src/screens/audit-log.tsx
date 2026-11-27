import type { AuditEventInfo } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";

import type { AuditKindOption } from "../audit-view";
import { auditEventDetail, auditEventSummary } from "../audit-view";
import { formatAge, formatDateTime, truncate } from "../format";
import { colors } from "../theme";

interface AuditLogScreenProps {
  events: AuditEventInfo[];
  selected: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  filterLabel: string;
  kindMenuOpen: boolean;
  kindOptions: AuditKindOption[];
  kindMenuIndex: number;
  coverageNote: string | null;
}

const WIDTHS = {
  cursor: 2,
  time: 10,
  kind: 14,
  result: 9,
  actor: 18,
} as const;
const FIXED_WIDTH = WIDTHS.cursor + WIDTHS.time + WIDTHS.kind + WIDTHS.result + WIDTHS.actor;
/** Root padding, card borders, card padding and the row's cursor inset. */
const ROW_CHROME = 7;

function resultColor(result: string): string {
  if (result === "success") {
    return colors.success;
  }
  if (result === "failure") {
    return colors.error;
  }
  return colors.muted;
}

export function AuditLogScreen({
  events,
  selected,
  loading,
  loadingMore,
  error,
  hasMore,
  filterLabel,
  kindMenuOpen,
  kindOptions,
  kindMenuIndex,
  coverageNote,
}: AuditLogScreenProps) {
  const { width } = useTerminalDimensions();
  const summaryWidth = Math.max(10, width - ROW_CHROME - FIXED_WIDTH);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    const id = selected >= events.length ? "audit-more" : `audit-${selected}`;
    scrollRef.current?.scrollChildIntoView(id, { align: "nearest" });
  }, [events.length, selected]);

  return (
    <box flexDirection="column" flexGrow={1}>
      <box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        overflow="hidden"
        border
        borderStyle="rounded"
        borderColor={colors.border}
        backgroundColor={colors.panel}
        title={`Audit log (${events.length})`}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <box flexDirection="row" flexShrink={0} justifyContent="space-between" paddingLeft={1}>
          <text fg={colors.muted}>
            Kind: <span fg={colors.text}>{filterLabel}</span>
          </text>
          <text fg={colors.muted}>Read-only · newest first</text>
        </box>

        {kindMenuOpen ? (
          <box flexDirection="column" flexShrink={0} paddingTop={1}>
            {kindOptions.map((option, index) => {
              const isCursor = index === kindMenuIndex;
              return (
                <box
                  key={option.id}
                  flexDirection="row"
                  flexShrink={0}
                  height={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={isCursor ? colors.selection : colors.panelAlt}
                >
                  <box width={2}>
                    <text fg={isCursor ? colors.accent : colors.muted}>{isCursor ? "›" : " "}</text>
                  </box>
                  <text fg={isCursor ? colors.accent : colors.text}>{option.label}</text>
                </box>
              );
            })}
          </box>
        ) : null}

        {coverageNote ? (
          <text fg={colors.warning} wrapMode="word" paddingTop={1}>
            {coverageNote}
          </text>
        ) : null}

        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}

        <box flexDirection="row" flexShrink={0} paddingLeft={1} paddingTop={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={WIDTHS.time}>
            <text fg={colors.muted}>TIME</text>
          </box>
          <box width={WIDTHS.kind}>
            <text fg={colors.muted}>KIND</text>
          </box>
          <box width={WIDTHS.result}>
            <text fg={colors.muted}>RESULT</text>
          </box>
          <box width={WIDTHS.actor}>
            <text fg={colors.muted}>ACTOR</text>
          </box>
          <box width={summaryWidth}>
            <text fg={colors.muted}>DESTINATION / REASON</text>
          </box>
        </box>

        {loading && events.length === 0 ? (
          <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
            Loading audit events…
          </text>
        ) : null}

        {!loading && !error && events.length === 0 ? (
          <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
            <text fg={colors.text}>No audit events.</text>
            <text fg={colors.muted} wrapMode="word">
              Outbound connections, egress denials and secret reads appear here.
            </text>
          </box>
        ) : null}

        <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} minHeight={0} scrollY>
          {events.map((event, index) => {
            const isSelected = index === selected;
            return (
              <box
                key={event.eventID ?? `${event.time}:${index}`}
                id={`audit-${index}`}
                flexDirection="column"
                flexShrink={0}
              >
                <box
                  flexDirection="row"
                  flexShrink={0}
                  paddingLeft={1}
                  backgroundColor={isSelected ? colors.selection : undefined}
                >
                  <box width={WIDTHS.cursor}>
                    <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                  </box>
                  <box width={WIDTHS.time}>
                    <text fg={colors.muted}>
                      {formatAge(event.time) === "—" ? "—" : `${formatAge(event.time)} ago`}
                    </text>
                  </box>
                  <box width={WIDTHS.kind}>
                    <text fg={colors.text} wrapMode="none">
                      {truncate(event.kind ?? "—", WIDTHS.kind - 1)}
                    </text>
                  </box>
                  <box width={WIDTHS.result}>
                    <text fg={resultColor(event.result)}>{event.result}</text>
                  </box>
                  <box width={WIDTHS.actor}>
                    <text fg={colors.muted} wrapMode="none">
                      {truncate(event.actor ?? "—", WIDTHS.actor - 1)}
                    </text>
                  </box>
                  <box width={summaryWidth}>
                    <text fg={colors.text} wrapMode="none">
                      {truncate(auditEventSummary(event), summaryWidth - 1)}
                    </text>
                  </box>
                </box>
                {isSelected ? (
                  <box paddingLeft={WIDTHS.cursor + 1} flexShrink={0}>
                    <text fg={colors.muted} wrapMode="word">
                      {auditEventDetail(event, formatDateTime(event.time))}
                    </text>
                  </box>
                ) : null}
              </box>
            );
          })}

          {hasMore ? (
            <box
              id="audit-more"
              flexDirection="row"
              flexShrink={0}
              paddingLeft={1}
              backgroundColor={selected >= events.length ? colors.selection : colors.panelAlt}
            >
              <box width={WIDTHS.cursor}>
                <text fg={colors.accent}>{selected >= events.length ? "›" : " "}</text>
              </box>
              <text fg={selected >= events.length ? colors.accent : colors.text}>
                {loadingMore ? "Loading more…" : "+ Load more"}
              </text>
            </box>
          ) : null}
        </scrollbox>
      </box>
    </box>
  );
}
