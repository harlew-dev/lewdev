import type { SandboxDetails } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { Panel } from "../components";
import { colors } from "../theme";

interface PortsScreenProps {
  details: SandboxDetails | null;
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = {
  cursor: 2,
  port: 8,
  visibility: 12,
} as const;

export function PortsScreen({ details, selected, loading, error }: PortsScreenProps) {
  const { height } = useTerminalDimensions();
  const ports = details?.exposedPorts ?? [];
  const rows = Math.max(3, height - 14);
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), ports.length - rows));
  const visible = ports.slice(start, start + rows);

  return (
    <Panel title="Ports" width={86}>
      {!details ? (
        <text fg={loading ? colors.muted : colors.error}>
          {loading ? "Loading ports…" : (error ?? "Ports are unavailable.")}
        </text>
      ) : (
        <>
          {error ? (
            <text fg={colors.error} wrapMode="word">
              {error}
            </text>
          ) : null}

          <box flexDirection="row" flexShrink={0}>
            <box width={WIDTHS.cursor}>
              <text> </text>
            </box>
            <box width={WIDTHS.port}>
              <text fg={colors.muted}>PORT</text>
            </box>
            <box width={WIDTHS.visibility}>
              <text fg={colors.muted}>VISIBILITY</text>
            </box>
            <box flexGrow={1}>
              <text fg={colors.muted}>URL</text>
            </box>
          </box>

          {ports.length === 0 ? (
            <box flexDirection="column" paddingTop={1} gap={1}>
              <text fg={colors.muted}>No exposed ports.</text>
              <text fg={colors.text}>
                Press <span fg={colors.accent}>o</span> to open one.
              </text>
            </box>
          ) : null}

          {visible.map((port, index) => {
            const absoluteIndex = start + index;
            const isSelected = absoluteIndex === selected;
            return (
              <box
                key={port.port}
                flexDirection="row"
                flexShrink={0}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={WIDTHS.port}>
                  <text fg={colors.text}>{port.port}</text>
                </box>
                <box width={WIDTHS.visibility}>
                  <text fg={port.visibility === "token" ? colors.warning : colors.success}>
                    {port.visibility === "token" ? "token" : "public"}
                  </text>
                </box>
                <box flexGrow={1}>
                  <text fg={colors.accent} selectable>
                    {port.url}
                  </text>
                </box>
              </box>
            );
          })}
        </>
      )}
    </Panel>
  );
}
