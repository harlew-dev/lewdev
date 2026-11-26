import type { SandboxDetails } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { portAddress, portTypeLabel } from "../port-options";
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
  const rows = Math.max(1, height - 17);
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), ports.length - rows));
  const visible = ports.slice(start, start + rows);
  const openSelected = selected >= ports.length;

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
        title={`Ports (${ports.length})`}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
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

            <box flexDirection="column" flexShrink={0}>
              <box flexDirection="row" flexShrink={0} paddingLeft={1}>
                <box width={WIDTHS.cursor}>
                  <text> </text>
                </box>
                <box width={WIDTHS.port}>
                  <text fg={colors.muted}>PORT</text>
                </box>
                <box width={WIDTHS.visibility}>
                  <text fg={colors.muted}>TYPE</text>
                </box>
                <box flexGrow={1}>
                  <text fg={colors.muted}>ADDRESS</text>
                </box>
              </box>

              {ports.length === 0 ? (
                <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
                  No exposed ports.
                </text>
              ) : null}

              {visible.map((port, index) => {
                const absoluteIndex = start + index;
                const isSelected = absoluteIndex === selected;
                const type = portTypeLabel(port);
                return (
                  <box
                    key={port.port}
                    flexDirection="row"
                    flexShrink={0}
                    paddingLeft={1}
                    backgroundColor={isSelected ? colors.selection : undefined}
                  >
                    <box width={WIDTHS.cursor}>
                      <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                    </box>
                    <box width={WIDTHS.port}>
                      <text fg={colors.text}>{port.port}</text>
                    </box>
                    <box width={WIDTHS.visibility}>
                      <text
                        fg={
                          port.protocol === "tcp"
                            ? colors.accent
                            : port.visibility === "token"
                              ? colors.warning
                              : colors.success
                        }
                      >
                        {type}
                      </text>
                    </box>
                    <box flexGrow={1}>
                      <text fg={colors.accent} selectable>
                        {portAddress(port)}
                      </text>
                    </box>
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
              backgroundColor={openSelected ? colors.selection : colors.panelAlt}
            >
              <text fg={openSelected ? colors.accent : colors.text}>+ Open port</text>
            </box>
          </>
        )}
      </box>
    </box>
  );
}
