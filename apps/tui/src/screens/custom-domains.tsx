import type { CustomDomainInfo, CustomDomainStatus } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";

import { customDomainStatusLabel, customDomainTargetLabel } from "../domain-form";
import { truncate } from "../format";
import { colors } from "../theme";

interface CustomDomainsScreenProps {
  domains: CustomDomainInfo[];
  selected: number;
  loading: boolean;
  error: string | null;
}

const WIDTHS = {
  cursor: 2,
  hostname: 34,
  status: 22,
} as const;

function statusColor(status: CustomDomainStatus): string {
  switch (status) {
    case "ready":
      return colors.success;
    case "failed":
      return colors.error;
    case "issuing":
      return colors.warning;
    default:
      return colors.muted;
  }
}

export function CustomDomainsScreen({
  domains,
  selected,
  loading,
  error,
}: CustomDomainsScreenProps) {
  const { width } = useTerminalDimensions();
  const hostnameWidth = Math.max(16, Math.min(WIDTHS.hostname, width - 50));
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    if (domains.length > 0) {
      scrollRef.current?.scrollChildIntoView(`domain-${selected}`, { align: "nearest" });
    }
  }, [domains.length, selected]);

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
        title={`Custom domains (${domains.length})`}
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

        <box flexDirection="row" flexShrink={0} paddingLeft={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={hostnameWidth}>
            <text fg={colors.muted}>HOSTNAME</text>
          </box>
          <box width={WIDTHS.status}>
            <text fg={colors.muted}>STATUS</text>
          </box>
          <box flexGrow={1}>
            <text fg={colors.muted}>ROUTES TO</text>
          </box>
        </box>

        {loading && domains.length === 0 ? (
          <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
            Loading custom domains…
          </text>
        ) : null}

        {!loading && !error && domains.length === 0 ? (
          <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
            <text fg={colors.text}>No custom domains yet.</text>
            <text fg={colors.muted} wrapMode="word">
              Press a to bind one. lewdev then shows the DNS records to create and tracks the
              certificate until it is ready.
            </text>
          </box>
        ) : null}

        <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} minHeight={0} scrollY>
          {domains.map((domain, index) => {
            const isSelected = index === selected;
            return (
              <box
                key={domain.hostname}
                id={`domain-${index}`}
                flexDirection="column"
                flexShrink={0}
              >
                <box
                  flexDirection="row"
                  flexShrink={0}
                  paddingLeft={1}
                  backgroundColor={isSelected ? colors.selection : undefined}
                >
                  <box width={WIDTHS.cursor}>
                    <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                  </box>
                  <box width={hostnameWidth}>
                    <text fg={isSelected ? colors.accent : colors.text} wrapMode="none">
                      {truncate(domain.hostname, hostnameWidth - 1)}
                    </text>
                  </box>
                  <box width={WIDTHS.status}>
                    <text fg={statusColor(domain.status)}>
                      {customDomainStatusLabel(domain.status)}
                    </text>
                  </box>
                  <box flexGrow={1}>
                    <text fg={colors.muted}>{customDomainTargetLabel(domain.targetPort)}</text>
                  </box>
                </box>
                {domain.status === "failed" && domain.lastError ? (
                  <box paddingLeft={WIDTHS.cursor + 1} flexShrink={0}>
                    <text fg={colors.error} wrapMode="word">
                      {domain.lastError}
                    </text>
                  </box>
                ) : null}
              </box>
            );
          })}
        </scrollbox>

        <text fg={colors.muted} flexShrink={0} paddingTop={1}>
          Statuses refresh while this page is open.
        </text>
      </box>
    </box>
  );
}
