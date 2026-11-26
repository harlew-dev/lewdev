import type { SandboxDetails, SandboxStatusReason } from "@lewdev/core";
import type { ReactNode } from "react";

import type { ActionGroup } from "../actions";
import { ActionScroller, Panel, selectedAction, StatusText } from "../components";
import {
  formatAge,
  formatCpu,
  formatDateTime,
  formatDisk,
  formatMemory,
  runtimeLabel,
} from "../format";
import { describeLifecycle } from "../lifecycle-form";
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

const STATUS_REASON_TEXT: Record<SandboxStatusReason, string> = {
  user_stop: "Stopped by a user",
  idle: "Stopped after being idle",
  max_age: "Stopped after reaching its maximum age",
  out_of_memory: "Stopped: out of memory",
  disk_limit: "Stopped: disk limit reached",
  crashed: "Stopped: crashed",
  reconcile: "Stopped: the server found it stopped unexpectedly",
  program_exited: "Main program exited",
  failover: "Recreated on another server after a failure",
  restarted: "Restarted after a crash",
  failover_disabled: "Failover was disabled for this sandbox",
  ownership_lease_expired: "Stopped: its server lost contact with the cluster",
};

function statusReasonText(
  reason: SandboxStatusReason | undefined,
  exitCode: number | undefined,
): string | null {
  if (reason === undefined) {
    return null;
  }
  const text = STATUS_REASON_TEXT[reason] ?? `Status reason: ${reason}`;
  return exitCode === undefined ? text : `${text} (exit code ${exitCode})`;
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
  const lastActive = formatAge(details.lastActiveAt);

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      <box
        border
        borderStyle="rounded"
        borderColor={colors.border}
        title="Sandbox"
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
          <InfoRow label="Name / ID">
            <text fg={details.name ? colors.text : colors.muted}>
              {details.name ?? "(unnamed)"}
              <span fg={colors.muted}> · {details.id}</span>
            </text>
          </InfoRow>
          <InfoRow label="Status">
            <StatusText status={details.status} />
          </InfoRow>
          {statusReasonText(details.statusReason, details.exitCode) ? (
            <InfoRow label="Reason">
              <text fg={colors.text} wrapMode="word">
                {statusReasonText(details.statusReason, details.exitCode)}
              </text>
            </InfoRow>
          ) : null}
          <InfoRow label="Image">
            <text fg={colors.text} wrapMode="word">
              {details.image}
            </text>
          </InfoRow>
          <InfoRow label="Runtime">
            <text fg={details.runtime ? colors.text : colors.muted}>
              {runtimeLabel(details.runtime)}
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
          <InfoRow label="Last active">
            <text fg={colors.text}>{lastActive === "—" ? "—" : `${lastActive} ago`}</text>
          </InfoRow>
          <InfoRow label="Lifecycle">
            <text fg={colors.text} wrapMode="word">
              {describeLifecycle(details.lifecycle)}
            </text>
          </InfoRow>
          <InfoRow label="Tags">
            <text fg={colors.text} wrapMode="word">
              {Object.keys(details.tags).length === 0
                ? "none"
                : Object.entries(details.tags)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")}
            </text>
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
