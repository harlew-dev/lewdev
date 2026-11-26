import {
  type AuthorizedKey,
  type DirectSshMode,
  SSH_PORT,
  type SandboxDetails,
} from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { buildSshDetailsGroups, type PageAction } from "../actions";
import { ActionList } from "../components";
import { colors } from "../theme";

export interface SshConnectionInfo {
  alias: string;
  mode: DirectSshMode | null;
  host: string | null;
  port: number | null;
  keyPath: string;
  keyAvailable: boolean;
  knownHostsPath: string;
  includePresent: boolean;
  sshdRunning: boolean | null;
  portOpen: boolean;
  explicitCommand: string | null;
}

interface SshDetailsScreenProps {
  details: SandboxDetails;
  connection: SshConnectionInfo;
  keys: AuthorizedKey[];
  keysLoading: boolean;
  keysError: string | null;
  gatewayHost: string | null;
  gatewayKeyPath: string | null;
  gatewayKeyAvailable: boolean;
  gatewayKnownHostsPath: string;
  actions: PageAction[];
  selectedIndex: number;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <box width={19} flexShrink={0}>
        <text fg={colors.muted}>{label}</text>
      </box>
      <box flexGrow={1}>{children}</box>
    </box>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={colors.border}
      backgroundColor={colors.panel}
      title={title}
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
      {children}
    </box>
  );
}

function yesNo(value: boolean, yes: string, no: string): ReactNode {
  return <text fg={value ? colors.success : colors.warning}>{value ? yes : no}</text>;
}

export function SshDetailsScreen({
  details,
  connection,
  keys,
  keysLoading,
  keysError,
  gatewayHost,
  gatewayKeyPath,
  gatewayKeyAvailable,
  gatewayKnownHostsPath,
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
        <Card title="Connection">
          <InfoRow label="Host alias">
            <text fg={colors.text} selectable>
              {connection.alias}
            </text>
          </InfoRow>
          <InfoRow label="Mode">
            <text fg={colors.text} wrapMode="word">
              {connection.mode === "private"
                ? "Private via AerolVM API"
                : connection.mode === "public"
                  ? "Public TCP"
                  : "not configured"}
            </text>
          </InfoRow>
          <InfoRow label="Host / port">
            <text
              fg={connection.mode === "public" && connection.host ? colors.text : colors.muted}
              selectable
              wrapMode="word"
            >
              {connection.mode === "private"
                ? "no exposed port"
                : connection.host
                  ? `${connection.host}:${connection.port ?? DIRECT_SSH_FALLBACK_PORT}`
                  : "not exposed"}
            </text>
          </InfoRow>
          <InfoRow label="User">
            <text fg={colors.text}>root</text>
          </InfoRow>
          <InfoRow label="Private key path">
            {connection.keyAvailable ? (
              <text fg={colors.text} selectable wrapMode="word">
                {connection.keyPath}
              </text>
            ) : (
              <text fg={colors.warning} wrapMode="word">
                Not created yet. Run Set up SSH on the sandbox page.
              </text>
            )}
          </InfoRow>
          <InfoRow label="Host key file">
            <text fg={colors.text} selectable wrapMode="word">
              {connection.knownHostsPath}
            </text>
          </InfoRow>
          <InfoRow label="~/.ssh/config">
            {yesNo(connection.includePresent, "lewdev Include present", "no lewdev Include")}
          </InfoRow>
          <InfoRow label="sshd">
            {connection.sshdRunning === null ? (
              <text fg={colors.muted}>checking…</text>
            ) : (
              yesNo(connection.sshdRunning, "running", "not running")
            )}
          </InfoRow>
          <InfoRow label="TCP port 22">
            {yesNo(connection.portOpen, "exposed", "not exposed")}
          </InfoRow>
          {connection.explicitCommand ? (
            <box flexDirection="column" flexShrink={0} paddingTop={1}>
              <text fg={colors.muted}>Explicit command</text>
              <text fg={colors.text} selectable wrapMode="word">
                {connection.explicitCommand}
              </text>
            </box>
          ) : null}
        </Card>

        <Card title="Authorized keys">
          {keysLoading ? <text fg={colors.muted}>Loading authorized keys…</text> : null}
          {keysError ? (
            <text fg={colors.error} wrapMode="word">
              {keysError}
            </text>
          ) : null}
          {!keysLoading && !keysError && keys.length === 0 ? (
            <text fg={colors.muted}>Root has no authorized keys.</text>
          ) : null}
          {keys.map((key, index) => (
            <box
              key={key.fingerprint}
              flexDirection="column"
              flexShrink={0}
              paddingBottom={index < keys.length - 1 ? 1 : 0}
            >
              <text fg={colors.text} wrapMode="word">
                {key.type}
                {key.comment ? ` ${key.comment}` : ""}
                {key.isLewdev ? <span fg={colors.accent}> (lewdev)</span> : null}
              </text>
              <text fg={colors.muted} selectable wrapMode="word">
                {key.fingerprint}
              </text>
            </box>
          ))}
        </Card>

        <Card title="Gateway terminal">
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
            {gatewayKeyAvailable && gatewayKeyPath ? (
              <text fg={colors.text} selectable wrapMode="word">
                {gatewayKeyPath}
              </text>
            ) : (
              <text fg={colors.warning} wrapMode="word">
                No gateway key is stored for this sandbox. Keys are only available for sandboxes
                lewdev created.
              </text>
            )}
          </InfoRow>
          <InfoRow label="Known hosts">
            <text fg={colors.text} selectable wrapMode="word">
              {gatewayKnownHostsPath}
            </text>
          </InfoRow>
          {details.sshPublicKey ? (
            <InfoRow label="Public key">
              <text fg={colors.text} selectable wrapMode="char">
                {details.sshPublicKey}
              </text>
            </InfoRow>
          ) : null}
        </Card>

        <ActionList groups={buildSshDetailsGroups(actions)} selectedIndex={selectedIndex} />
      </box>
    </scrollbox>
  );
}

const DIRECT_SSH_FALLBACK_PORT = 22;
