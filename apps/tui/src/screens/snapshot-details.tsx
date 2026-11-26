import type { SandboxInfo, SnapshotInfo } from "@lewdev/core";
import type { ReactNode } from "react";

import type { ActionGroup } from "../actions";
import { ActionScroller, Panel, selectedAction } from "../components";
import {
  formatCpu,
  formatDateTime,
  formatDisk,
  formatMemory,
  snapshotSourceLabel,
} from "../format";
import { colors } from "../theme";

interface SnapshotDetailsScreenProps {
  snapshot: SnapshotInfo | null;
  sandboxes: SandboxInfo[];
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

export function SnapshotDetailsScreen({
  snapshot,
  sandboxes,
  loading,
  error,
  groups,
  selectedIndex,
}: SnapshotDetailsScreenProps) {
  if (!snapshot) {
    return (
      <Panel title="Snapshot" width={80}>
        <text fg={loading ? colors.muted : colors.error}>
          {loading ? "Loading snapshot details…" : (error ?? "Snapshot details are unavailable.")}
        </text>
      </Panel>
    );
  }

  const selected = selectedAction(groups, selectedIndex);

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      <box
        border
        borderStyle="rounded"
        borderColor={colors.border}
        title="Snapshot"
        titleColor={colors.accent}
        backgroundColor={colors.panel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        gap={1}
        flexShrink={0}
      >
        <box flexDirection="column" gap={0}>
          <InfoRow label="Name">
            <text fg={colors.text} selectable>
              {snapshot.name}
            </text>
          </InfoRow>
          <InfoRow label="Image">
            <text fg={colors.text} wrapMode="word">
              {snapshot.image}
            </text>
          </InfoRow>
          {snapshot.imageID ? (
            <InfoRow label="Image ID">
              <text fg={colors.muted} selectable wrapMode="word">
                {snapshot.imageID}
              </text>
            </InfoRow>
          ) : null}
          <InfoRow label="Source sandbox">
            <text fg={colors.text}>
              {snapshotSourceLabel(snapshot, sandboxes)}
              <span fg={colors.muted}> · {snapshot.sourceSandboxID}</span>
            </text>
          </InfoRow>
          <InfoRow label="Created">
            <text fg={colors.text}>{formatDateTime(snapshot.createdAt)}</text>
          </InfoRow>
          <InfoRow label="CPU">
            <text fg={colors.text}>
              {snapshot.cpu === undefined ? "—" : formatCpu(snapshot.cpu)}
            </text>
          </InfoRow>
          {snapshot.gpu !== undefined ? (
            <InfoRow label="GPU">
              <text fg={colors.text}>{snapshot.gpu}</text>
            </InfoRow>
          ) : null}
          <InfoRow label="Memory">
            <text fg={colors.text}>
              {snapshot.memoryMB === undefined ? "—" : formatMemory(snapshot.memoryMB)}
            </text>
          </InfoRow>
          <InfoRow label="Disk">
            <text fg={colors.text}>
              {snapshot.diskGB === undefined ? "—" : formatDisk(snapshot.diskGB)}
            </text>
          </InfoRow>
          {snapshot.regionID ? (
            <InfoRow label="Region">
              <text fg={colors.text}>{snapshot.regionID}</text>
            </InfoRow>
          ) : null}
          {snapshot.entrypoint && snapshot.entrypoint.length > 0 ? (
            <InfoRow label="Entrypoint">
              <text fg={colors.text} wrapMode="word">
                {snapshot.entrypoint.join(" ")}
              </text>
            </InfoRow>
          ) : null}
        </box>

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
