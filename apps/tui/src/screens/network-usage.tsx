import type { NetworkUsageInfo } from "@lewdev/core";
import type { ReactNode } from "react";

import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { formatAge, formatDateTime } from "../format";
import { formatBytes, formatLimit } from "../network-form";
import { colors } from "../theme";

interface NetworkUsageScreenProps {
  usage: NetworkUsageInfo | null;
  loading: boolean;
  error: string | null;
  actions: PageAction[];
  selectedIndex: number;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <box width={18} flexShrink={0}>
        <text fg={colors.muted}>{label}</text>
      </box>
      <box flexGrow={1}>{children}</box>
    </box>
  );
}

function trafficText(used: number, limit: number): string {
  if (limit <= 0) {
    return `${formatBytes(used)} · no limit`;
  }
  const percent = Math.round((used / limit) * 100);
  return `${formatBytes(used)} of ${formatBytes(limit)} (${percent}%)`;
}

export function NetworkUsageScreen({
  usage,
  loading,
  error,
  actions,
  selectedIndex,
}: NetworkUsageScreenProps) {
  if (!usage) {
    return (
      <Panel title="Network usage" width={80}>
        <text fg={loading ? colors.muted : colors.error}>
          {loading ? "Loading network usage…" : (error ?? "Network usage is unavailable.")}
        </text>
      </Panel>
    );
  }

  const sampled = usage.lastSampledAt ? formatAge(usage.lastSampledAt) : null;

  return (
    <Panel title="Network usage" width={84}>
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <box flexDirection="column" flexShrink={0}>
        <InfoRow label="Inbound">
          <text fg={colors.text}>{trafficText(usage.bytesIn, usage.bytesInLimit)}</text>
        </InfoRow>
        <InfoRow label="Outbound">
          <text fg={colors.text}>{trafficText(usage.bytesOut, usage.bytesOutLimit)}</text>
        </InfoRow>
        <InfoRow label="Limits">
          <text fg={colors.text}>
            in {formatLimit(usage.bytesInLimit)} · out {formatLimit(usage.bytesOutLimit)}
          </text>
        </InfoRow>
        <InfoRow label="Last sampled">
          <text fg={usage.lastSampledAt ? colors.text : colors.muted}>
            {usage.lastSampledAt
              ? `${sampled} ago · ${formatDateTime(usage.lastSampledAt)}`
              : "Not sampled yet"}
          </text>
        </InfoRow>
      </box>

      {usage.quotaExceeded ? (
        <box flexDirection="column" flexShrink={0}>
          <text fg={colors.warning} wrapMode="word">
            Quota exceeded
            {usage.quotaExceededAt ? ` since ${formatDateTime(usage.quotaExceededAt)}` : ""}.
          </text>
          <text fg={colors.muted} wrapMode="word">
            Traffic is dropped once a cap is crossed and stays blocked until you raise it. Set a
            higher limit or choose No limit to restore it.
          </text>
        </box>
      ) : (
        <text fg={colors.success} wrapMode="word">
          Within limits.
        </text>
      )}

      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
