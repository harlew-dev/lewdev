import type { SandboxInfo, SnapshotInfo } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import {
  formatAge,
  formatCpu,
  formatDisk,
  formatMemory,
  snapshotSourceLabel,
  truncate,
} from "../format";
import { SNAPSHOT_COLUMN_WIDTHS, visibleSnapshotColumns } from "../list-columns";
import { colors } from "../theme";

interface SnapshotsScreenProps {
  snapshots: SnapshotInfo[];
  sandboxes: SandboxInfo[];
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = SNAPSHOT_COLUMN_WIDTHS;
/** Root padding, card borders, tab bar and card padding around the table. */
const CARD_CHROME = 6;

export function SnapshotsScreen({
  snapshots,
  sandboxes,
  selected,
  loading,
  error,
}: SnapshotsScreenProps) {
  const { width, height } = useTerminalDimensions();
  const innerWidth = Math.max(0, width - CARD_CHROME);
  const columns = visibleSnapshotColumns(innerWidth);
  const show = (column: (typeof columns)[number]) => columns.includes(column);
  // Leave room for the tab bar, card borders, the table header, the separator,
  // the New snapshot button, the footer, the usage bar and the page chrome.
  const visibleRows = Math.max(1, height - 19);
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(visibleRows / 2), snapshots.length - visibleRows),
  );
  const visible = snapshots.slice(start, start + visibleRows);
  const newSelected = selected >= snapshots.length;

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
        title={`Snapshots (${snapshots.length})`}
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

        <box flexDirection="column" flexShrink={0}>
          <box flexDirection="row" flexShrink={0} paddingLeft={1}>
            <box width={WIDTHS.cursor}>
              <text> </text>
            </box>
            <box width={WIDTHS.name}>
              <text fg={colors.muted}>NAME</text>
            </box>
            {show("source") ? (
              <box width={WIDTHS.source}>
                <text fg={colors.muted}>SOURCE</text>
              </box>
            ) : null}
            <box width={WIDTHS.image}>
              <text fg={colors.muted}>IMAGE</text>
            </box>
            <box width={WIDTHS.cpu}>
              <text fg={colors.muted}>CPU</text>
            </box>
            <box width={WIDTHS.memory}>
              <text fg={colors.muted}>MEMORY</text>
            </box>
            {show("disk") ? (
              <box width={WIDTHS.disk}>
                <text fg={colors.muted}>DISK</text>
              </box>
            ) : null}
            {show("created") ? (
              <box width={WIDTHS.created}>
                <text fg={colors.muted}>CREATED</text>
              </box>
            ) : null}
            <box flexGrow={1} />
          </box>

          {loading && snapshots.length === 0 ? (
            <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
              Loading snapshots…
            </text>
          ) : null}

          {!loading && snapshots.length === 0 ? (
            <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
              No snapshots yet.
            </text>
          ) : null}

          {visible.map((snapshot, index) => {
            const absoluteIndex = start + index;
            const isSelected = absoluteIndex === selected;
            return (
              <box
                key={snapshot.name}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={WIDTHS.name}>
                  <text fg={colors.text}>{truncate(snapshot.name, WIDTHS.name - 1)}</text>
                </box>
                {show("source") ? (
                  <box width={WIDTHS.source}>
                    <text fg={colors.muted}>
                      {truncate(snapshotSourceLabel(snapshot, sandboxes), WIDTHS.source - 1)}
                    </text>
                  </box>
                ) : null}
                <box width={WIDTHS.image}>
                  <text fg={colors.text}>{truncate(snapshot.image, WIDTHS.image - 1)}</text>
                </box>
                <box width={WIDTHS.cpu}>
                  <text fg={colors.muted}>
                    {snapshot.cpu === undefined ? "—" : formatCpu(snapshot.cpu)}
                  </text>
                </box>
                <box width={WIDTHS.memory}>
                  <text fg={colors.muted}>
                    {snapshot.memoryMB === undefined ? "—" : formatMemory(snapshot.memoryMB)}
                  </text>
                </box>
                {show("disk") ? (
                  <box width={WIDTHS.disk}>
                    <text fg={colors.muted}>
                      {snapshot.diskGB === undefined ? "—" : formatDisk(snapshot.diskGB)}
                    </text>
                  </box>
                ) : null}
                {show("created") ? (
                  <box width={WIDTHS.created}>
                    <text fg={colors.muted}>{formatAge(snapshot.createdAt)}</text>
                  </box>
                ) : null}
                <box flexGrow={1} />
              </box>
            );
          })}
        </box>

        <box height={1} flexShrink={0} />
        <box
          flexDirection="row"
          flexShrink={0}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={newSelected ? colors.selection : colors.panelAlt}
        >
          <text fg={newSelected ? colors.accent : colors.text}>+ New snapshot</text>
        </box>
      </box>
    </box>
  );
}
