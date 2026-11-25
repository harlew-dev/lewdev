import type { PortVisibility, SandboxDetails } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { Field, Panel } from "../components";
import { sandboxLabel } from "../format";
import { colors } from "../theme";

export interface PortFormValues {
  field: "port" | "visibility";
  port: string;
  visibility: PortVisibility;
}

interface PortsScreenProps {
  details: SandboxDetails | null;
  selected: number;
  loading: boolean;
  error: string | null;
  form: PortFormValues | null;
  formError: string | null;
}

const WIDTHS = {
  cursor: 2,
  port: 8,
  visibility: 12,
} as const;

export function PortsScreen({
  details,
  selected,
  loading,
  error,
  form,
  formError,
}: PortsScreenProps) {
  const { height } = useTerminalDimensions();
  const ports = details?.exposedPorts ?? [];
  const rows = Math.max(3, height - (form ? 20 : 14));
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), ports.length - rows));
  const visible = ports.slice(start, start + rows);

  return (
    <Panel title={details ? `Ports · ${sandboxLabel(details)}` : "Ports"} width={86}>
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

          {form ? (
            <box flexDirection="column" gap={1} paddingTop={1}>
              <text fg={colors.muted}>Open a port</text>
              <Field
                label="Port"
                value={form.port}
                active={form.field === "port"}
                placeholder="8080"
              />
              <Field
                label="Visibility"
                value={form.visibility}
                active={form.field === "visibility"}
                display={`[ ${form.visibility} ]`}
              />
              <text fg={colors.muted}>
                public serves anyone with the URL; token requires a sandbox token.
              </text>
              {formError ? (
                <text fg={colors.error} wrapMode="word">
                  {formError}
                </text>
              ) : null}
            </box>
          ) : null}
        </>
      )}
    </Panel>
  );
}
