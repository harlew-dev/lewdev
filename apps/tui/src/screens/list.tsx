import type { SandboxInfo } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { StatusText } from "../components";
import {
  formatAge,
  formatCpu,
  formatDisk,
  formatMemory,
  sandboxLabel,
  shortId,
  shortStatus,
  truncate,
} from "../format";
import { LIST_COLUMN_WIDTHS, visibleListColumns } from "../list-columns";
import { colors } from "../theme";

interface ListScreenProps {
  sandboxes: SandboxInfo[];
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = LIST_COLUMN_WIDTHS;
/** Root padding, card borders and card padding around the table. */
const CARD_CHROME = 6;

export function ListScreen({ sandboxes, selected, loading, error }: ListScreenProps) {
  const { width, height } = useTerminalDimensions();
  const innerWidth = Math.max(0, width - CARD_CHROME);
  const columns = visibleListColumns(innerWidth);
  const show = (column: (typeof columns)[number]) => columns.includes(column);
  // Leave room for the card borders, the table header, the separator, the New
  // sandbox button, the footer and the page chrome so the button is never
  // pushed out.
  const visibleRows = Math.max(1, height - 17);
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(visibleRows / 2), sandboxes.length - visibleRows),
  );
  const visible = sandboxes.slice(start, start + visibleRows);
  const newSelected = selected >= sandboxes.length;

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
        title={`Sandboxes (${sandboxes.length})`}
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
            {show("id") ? (
              <box width={WIDTHS.id}>
                <text fg={colors.muted}>ID</text>
              </box>
            ) : null}
            <box width={WIDTHS.image}>
              <text fg={colors.muted}>IMAGE</text>
            </box>
            <box width={WIDTHS.status}>
              <text fg={colors.muted}>STATUS</text>
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

          {loading && sandboxes.length === 0 ? (
            <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
              Loading sandboxes…
            </text>
          ) : null}

          {!loading && sandboxes.length === 0 ? (
            <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
              No sandboxes yet.
            </text>
          ) : null}

          {visible.map((sandbox, index) => {
            const absoluteIndex = start + index;
            const isSelected = absoluteIndex === selected;
            return (
              <box
                key={sandbox.id}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={WIDTHS.name}>
                  <text fg={sandbox.name ? colors.text : colors.muted}>
                    {truncate(sandboxLabel(sandbox), WIDTHS.name - 1)}
                  </text>
                </box>
                {show("id") ? (
                  <box width={WIDTHS.id}>
                    <text fg={colors.muted}>{shortId(sandbox.id)}</text>
                  </box>
                ) : null}
                <box width={WIDTHS.image}>
                  <text fg={colors.text}>{truncate(sandbox.image, WIDTHS.image - 1)}</text>
                </box>
                <box width={WIDTHS.status}>
                  <StatusText status={sandbox.status} label={shortStatus(sandbox.status)} />
                </box>
                <box width={WIDTHS.cpu}>
                  <text fg={colors.muted}>{formatCpu(sandbox.cpu)}</text>
                </box>
                <box width={WIDTHS.memory}>
                  <text fg={colors.muted}>{formatMemory(sandbox.memoryMB)}</text>
                </box>
                {show("disk") ? (
                  <box width={WIDTHS.disk}>
                    <text fg={colors.muted}>{formatDisk(sandbox.diskGB)}</text>
                  </box>
                ) : null}
                {show("created") ? (
                  <box width={WIDTHS.created}>
                    <text fg={colors.muted}>{formatAge(sandbox.createdAt)}</text>
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
          <text fg={newSelected ? colors.accent : colors.text}>+ New sandbox</text>
        </box>
      </box>
    </box>
  );
}
