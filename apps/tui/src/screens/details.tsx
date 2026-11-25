import type { SandboxDetails } from "@lewdev/core";
import type { ReactNode } from "react";

import { Panel, StatusText } from "../components";
import type { DetailsMenuItem } from "../details-menu";
import { formatDateTime, sandboxLabel } from "../format";
import { colors } from "../theme";

interface DetailsScreenProps {
  details: SandboxDetails | null;
  loading: boolean;
  error: string | null;
  menu: DetailsMenuItem[];
  selectedIndex: number;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <box width={17} flexShrink={0}>
        <text fg={colors.muted}>{label}</text>
      </box>
      <box flexGrow={1}>{children}</box>
    </box>
  );
}

export function DetailsScreen({
  details,
  loading,
  error,
  menu,
  selectedIndex,
}: DetailsScreenProps) {
  if (!details) {
    return (
      <Panel title="Sandbox" width={80}>
        <text fg={loading ? colors.muted : colors.error}>
          {loading ? "Loading sandbox details…" : (error ?? "Sandbox details are unavailable.")}
        </text>
      </Panel>
    );
  }

  const selected = menu[selectedIndex];

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      <box
        backgroundColor={colors.panel}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={0}
        flexShrink={0}
      >
        <text fg={colors.accent}>Sandbox {sandboxLabel(details)}</text>
        <box flexDirection="column" gap={0}>
          <InfoRow label="Status">
            <StatusText status={details.status} />
          </InfoRow>
          <InfoRow label="Name / ID">
            <text fg={details.name ? colors.text : colors.muted}>
              {details.name ?? "(unnamed)"}
              <span fg={colors.muted}> · {details.id}</span>
            </text>
          </InfoRow>
          <InfoRow label="Image">
            <text fg={colors.text} wrapMode="word">
              {details.image}
            </text>
          </InfoRow>
          <InfoRow label="CPU / Mem / Disk">
            <text fg={colors.text}>
              {details.cpu} CPU · {details.memoryMB} MB · {details.diskGB} GB
            </text>
          </InfoRow>
          <InfoRow label="Created">
            <text fg={colors.text}>{formatDateTime(details.createdAt)}</text>
          </InfoRow>
          <InfoRow label="Public URL">
            <text fg={details.publicURL ? colors.accent : colors.muted} selectable wrapMode="word">
              {details.publicURL || "none"}
            </text>
          </InfoRow>
          <InfoRow label="Ports">
            <text fg={colors.text}>{details.exposedPorts.length} exposed</text>
          </InfoRow>
        </box>

        {details.lastError ? (
          <text fg={colors.error} wrapMode="word">
            Last error: {details.lastError}
          </text>
        ) : null}
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}
      </box>

      <box flexDirection="column" flexGrow={1} paddingTop={1}>
        {menu.map((item, index) => {
          const isSelected = index === selectedIndex;
          const labelColor =
            item.tone === "error"
              ? colors.error
              : !item.enabled
                ? colors.muted
                : isSelected
                  ? colors.accent
                  : colors.text;
          return (
            <box
              key={item.id}
              flexDirection="row"
              flexShrink={0}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isSelected ? colors.selection : undefined}
            >
              <box width={2}>
                <text fg={isSelected ? colors.accent : colors.muted}>{isSelected ? "›" : " "}</text>
              </box>
              <box flexGrow={1}>
                <text fg={labelColor}>{item.label}</text>
              </box>
              <text fg={!item.enabled ? colors.muted : isSelected ? colors.accent : colors.muted}>
                {item.shortcut}
              </text>
            </box>
          );
        })}
      </box>

      <text fg={colors.muted} wrapMode="word" flexShrink={0}>
        {selected?.description ?? "No actions available."}
      </text>
    </box>
  );
}
