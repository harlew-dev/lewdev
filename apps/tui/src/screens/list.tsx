import type { SandboxInfo } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { StatusText } from "../components";
import {
  formatAge,
  formatResources,
  sandboxLabel,
  shortId,
  shortStatus,
  truncate,
} from "../format";
import { colors } from "../theme";

interface ListScreenProps {
  sandboxes: SandboxInfo[];
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = {
  cursor: 2,
  name: 16,
  id: 11,
  image: 16,
  status: 10,
  resources: 13,
} as const;

export function ListScreen({ sandboxes, selected, loading, error }: ListScreenProps) {
  const { height } = useTerminalDimensions();
  const visibleRows = Math.max(3, height - 13);
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(visibleRows / 2), sandboxes.length - visibleRows),
  );
  const visible = sandboxes.slice(start, start + visibleRows);

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" gap={1} flexShrink={0}>
        <text fg={colors.text}>Sandboxes</text>
        <text fg={colors.muted}>({sandboxes.length})</text>
      </box>

      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}

      <box flexDirection="column" flexGrow={1} paddingTop={1}>
        <box flexDirection="row" flexShrink={0} paddingLeft={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={WIDTHS.name}>
            <text fg={colors.muted}>NAME</text>
          </box>
          <box width={WIDTHS.id}>
            <text fg={colors.muted}>ID</text>
          </box>
          <box width={WIDTHS.image}>
            <text fg={colors.muted}>IMAGE</text>
          </box>
          <box width={WIDTHS.status}>
            <text fg={colors.muted}>STATUS</text>
          </box>
          <box width={WIDTHS.resources}>
            <text fg={colors.muted}>CPU / MEM</text>
          </box>
          <box flexGrow={1}>
            <text fg={colors.muted}>CREATED</text>
          </box>
        </box>

        {loading && sandboxes.length === 0 ? (
          <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
            Loading sandboxes…
          </text>
        ) : null}

        {!loading && sandboxes.length === 0 ? (
          <box flexDirection="column" paddingLeft={1} paddingTop={1} gap={1}>
            <text fg={colors.muted}>No sandboxes yet.</text>
            <text fg={colors.text}>
              Press <span fg={colors.accent}>n</span> to create one from an image.
            </text>
          </box>
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
              <box width={WIDTHS.id}>
                <text fg={colors.muted}>{shortId(sandbox.id)}</text>
              </box>
              <box width={WIDTHS.image}>
                <text fg={colors.text}>{truncate(sandbox.image, WIDTHS.image - 1)}</text>
              </box>
              <box width={WIDTHS.status}>
                <StatusText status={sandbox.status} label={shortStatus(sandbox.status)} />
              </box>
              <box width={WIDTHS.resources}>
                <text fg={colors.muted}>
                  {truncate(formatResources(sandbox.cpu, sandbox.memoryMB), WIDTHS.resources - 1)}
                </text>
              </box>
              <box flexGrow={1}>
                <text fg={colors.muted}>{formatAge(sandbox.createdAt)}</text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
