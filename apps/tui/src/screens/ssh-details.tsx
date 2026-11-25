import type { SandboxDetails } from "@lewdev/core";
import { SSH_PORT } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { PageAction } from "../actions";
import { ActionList } from "../components";
import { colors } from "../theme";

interface SshDetailsScreenProps {
  details: SandboxDetails;
  gatewayHost: string | null;
  keyPath: string | null;
  keyAvailable: boolean;
  knownHostsPath: string;
  actions: PageAction[];
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

export function SshDetailsScreen({
  details,
  gatewayHost,
  keyPath,
  keyAvailable,
  knownHostsPath,
  actions,
  selectedIndex,
}: SshDetailsScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const selectedId = actions[selectedIndex]?.id;

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    scrollRef.current?.scrollChildIntoView(`action-${selectedId}`, { align: "nearest" });
  }, [selectedId]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <box flexDirection="column" gap={1}>
        <box
          border
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.panel}
          title="SSH"
          titleColor={colors.accent}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
          flexShrink={0}
          width="100%"
        >
          <InfoRow label="Host">
            <text fg={gatewayHost ? colors.text : colors.error}>
              {gatewayHost ?? "unavailable (check the API URL)"}
            </text>
          </InfoRow>
          <InfoRow label="Port">
            <text fg={colors.text}>{SSH_PORT}</text>
          </InfoRow>
          <InfoRow label="Username">
            <text fg={colors.text} selectable>
              {details.id}
            </text>
          </InfoRow>
          <InfoRow label="Private key path">
            {keyAvailable && keyPath ? (
              <text fg={colors.text} selectable wrapMode="word">
                {keyPath}
              </text>
            ) : (
              <text fg={colors.warning} wrapMode="word">
                No private key is stored for this sandbox. Keys are only available for sandboxes
                lewdev created.
              </text>
            )}
          </InfoRow>
          <InfoRow label="Known hosts">
            <text fg={colors.text} selectable wrapMode="word">
              {knownHostsPath}
            </text>
          </InfoRow>
          {details.sshPublicKey ? (
            <InfoRow label="Public key">
              <text fg={colors.text} selectable wrapMode="char">
                {details.sshPublicKey}
              </text>
            </InfoRow>
          ) : null}
        </box>

        <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
      </box>
    </scrollbox>
  );
}
