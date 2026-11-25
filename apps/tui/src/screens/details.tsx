import type { SandboxDetails } from "@lewdev/core";
import type { ReactNode } from "react";

import type { ActionGroup } from "../actions";
import { ActionScroller, Panel, selectedAction, StatusText } from "../components";
import { formatCpu, formatDateTime, formatDisk, formatMemory } from "../format";
import { colors } from "../theme";

interface DetailsScreenProps {
  details: SandboxDetails | null;
  loading: boolean;
  error: string | null;
  groups: ActionGroup[];
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
  groups,
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

  const selected = selectedAction(groups, selectedIndex);

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      <box
        backgroundColor={colors.panel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        gap={1}
        flexShrink={0}
      >
        <text fg={colors.accent}>Sandbox</text>
        <box flexDirection="column" gap={0}>
          <InfoRow label="Name / ID">
            <text fg={details.name ? colors.text : colors.muted}>
              {details.name ?? "(unnamed)"}
              <span fg={colors.muted}> · {details.id}</span>
            </text>
          </InfoRow>
          <InfoRow label="Status">
            <StatusText status={details.status} />
          </InfoRow>
          <InfoRow label="Image">
            <text fg={colors.text} wrapMode="word">
              {details.image}
            </text>
          </InfoRow>
          <InfoRow label="CPU">
            <text fg={colors.text}>{formatCpu(details.cpu)}</text>
          </InfoRow>
          <InfoRow label="Memory">
            <text fg={colors.text}>{formatMemory(details.memoryMB)}</text>
          </InfoRow>
          <InfoRow label="Disk">
            <text fg={colors.text}>{formatDisk(details.diskGB)}</text>
          </InfoRow>
          <InfoRow label="Created">
            <text fg={colors.text}>{formatDateTime(details.createdAt)}</text>
          </InfoRow>
          <InfoRow label="Public URL">
            <text fg={details.publicURL ? colors.accent : colors.muted} selectable wrapMode="word">
              {details.publicURL || "none"}
            </text>
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

      <box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        overflow="hidden"
        paddingTop={1}
      >
        <ActionScroller groups={groups} selectedIndex={selectedIndex} />
      </box>

      {selected && !selected.enabled ? (
        <text fg={colors.muted} wrapMode="word" flexShrink={0}>
          {selected.unavailableReason ?? "This action is unavailable."}
        </text>
      ) : null}
    </box>
  );
}
