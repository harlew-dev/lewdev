import type { SandboxDetails } from "@lewdev/core";
import { SSH_PORT } from "@lewdev/core";
import type { ReactNode } from "react";

import { colors } from "../theme";

interface SshDetailsScreenProps {
  details: SandboxDetails;
  gatewayHost: string | null;
  keyPath: string | null;
  keyAvailable: boolean;
  sshCommand: string | null;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <box width={15} flexShrink={0}>
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
  sshCommand,
}: SshDetailsScreenProps) {
  return (
    <box flexDirection="column" flexGrow={1} gap={1}>
      <box
        border
        borderStyle="rounded"
        borderColor={colors.border}
        backgroundColor={colors.panel}
        title="SSH details"
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        gap={0}
      >
        <InfoRow label="Gateway host">
          <text fg={gatewayHost ? colors.text : colors.error}>
            {gatewayHost ?? "unavailable (check the API URL)"}
          </text>
        </InfoRow>
        <InfoRow label="Gateway port">
          <text fg={colors.text}>{SSH_PORT}</text>
        </InfoRow>
        <InfoRow label="Login user">
          <text fg={colors.text} selectable>
            {details.id}
          </text>
        </InfoRow>
        <InfoRow label="Key path">
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
        <InfoRow label="Command">
          {sshCommand ? (
            <text fg={colors.text} selectable wrapMode="word">
              {sshCommand}
            </text>
          ) : (
            <text fg={colors.error}>The SSH command is unavailable.</text>
          )}
        </InfoRow>
        {details.sshPublicKey ? (
          <InfoRow label="Public key">
            <text fg={colors.text} selectable wrapMode="char">
              {details.sshPublicKey}
            </text>
          </InfoRow>
        ) : null}
      </box>

      <text fg={colors.muted} wrapMode="word">
        Press y to copy the full SSH command.
      </text>
    </box>
  );
}
