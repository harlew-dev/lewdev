import type { TerminalSession, TerminalSessionStatus } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";

import { formatAge, truncate } from "../format";
import { sessionCommand } from "../sessions";
import { colors } from "../theme";

interface SessionsScreenProps {
  sessions: TerminalSession[];
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = {
  cursor: 2,
  name: 16,
  status: 10,
  started: 10,
  exit: 7,
  attached: 9,
} as const;
const FIXED_WIDTH =
  WIDTHS.cursor + WIDTHS.name + WIDTHS.status + WIDTHS.started + WIDTHS.exit + WIDTHS.attached;
/** Root padding, card borders, card padding and the row's cursor inset. */
const ROW_CHROME = 7;

function statusColor(status: TerminalSessionStatus): string {
  switch (status) {
    case "running":
      return colors.success;
    case "killed":
      return colors.warning;
    case "failed":
      return colors.error;
    default:
      return colors.muted;
  }
}

export function SessionsScreen({ sessions, selected, loading, error }: SessionsScreenProps) {
  const { width } = useTerminalDimensions();
  const commandWidth = Math.max(10, width - ROW_CHROME - FIXED_WIDTH);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    if (sessions.length > 0) {
      scrollRef.current?.scrollChildIntoView(`session-${selected}`, { align: "nearest" });
    }
  }, [sessions.length, selected]);

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
        title={`Sessions (${sessions.length})`}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}

        <box flexDirection="row" flexShrink={0} paddingLeft={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={WIDTHS.name}>
            <text fg={colors.muted}>NAME</text>
          </box>
          <box width={commandWidth}>
            <text fg={colors.muted}>COMMAND</text>
          </box>
          <box width={WIDTHS.status}>
            <text fg={colors.muted}>STATUS</text>
          </box>
          <box width={WIDTHS.started}>
            <text fg={colors.muted}>STARTED</text>
          </box>
          <box width={WIDTHS.exit}>
            <text fg={colors.muted}>EXIT</text>
          </box>
          <box width={WIDTHS.attached}>
            <text fg={colors.muted}>ATTACHED</text>
          </box>
          <box flexGrow={1} />
        </box>

        {loading && sessions.length === 0 ? (
          <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
            Loading sessions…
          </text>
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
            <text fg={colors.text}>No sessions yet.</text>
            <text fg={colors.muted} wrapMode="word">
              Open terminal or start a new shell session to keep work running when you leave.
            </text>
          </box>
        ) : null}

        <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} minHeight={0} scrollY>
          {sessions.map((session, index) => {
            const isSelected = index === selected;
            const command = sessionCommand(session);
            return (
              <box
                key={session.id}
                id={`session-${index}`}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={WIDTHS.name}>
                  <text fg={isSelected ? colors.accent : colors.text}>
                    {truncate(session.name || "(unnamed)", WIDTHS.name - 1)}
                  </text>
                </box>
                <box width={commandWidth}>
                  <text fg={colors.text} wrapMode="none">
                    {truncate(command, commandWidth - 1)}
                  </text>
                </box>
                <box width={WIDTHS.status}>
                  <text fg={statusColor(session.status)}>● {session.status}</text>
                </box>
                <box width={WIDTHS.started}>
                  <text fg={colors.muted}>{formatAge(session.startedAt)} ago</text>
                </box>
                <box width={WIDTHS.exit}>
                  <text fg={colors.muted}>
                    {session.status === "running" ? "—" : String(session.exitCode)}
                  </text>
                </box>
                <box width={WIDTHS.attached}>
                  <text fg={colors.muted}>{session.attached}</text>
                </box>
                <box flexGrow={1} />
              </box>
            );
          })}
        </scrollbox>

        <text fg={colors.muted} flexShrink={0} paddingTop={1}>
          Sessions end when the sandbox stops.
        </text>
      </box>
    </box>
  );
}
