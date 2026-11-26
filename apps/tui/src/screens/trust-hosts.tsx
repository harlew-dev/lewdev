import type { GatewayHostKey } from "@lewdev/core";

import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface TrustHostsScreenProps {
  entry: string;
  keys: GatewayHostKey[];
  failedAddresses: string[];
  actions: PageAction[];
  selectedIndex: number;
}

export function TrustHostsScreen({
  entry,
  keys,
  failedAddresses,
  actions,
  selectedIndex,
}: TrustHostsScreenProps) {
  return (
    <Panel title="Trust gateway host keys" width={78}>
      <text fg={colors.text} wrapMode="word">
        Save every key for <span fg={colors.accent}>{entry}</span> in lewdev&apos;s known_hosts.
      </text>
      <text fg={colors.muted} wrapMode="word">
        The gateway resolves to several nodes, each with its own key. Saving all of them stops
        random host key failures.
      </text>
      {keys.map((key) => (
        <box key={key.line} flexDirection="column" flexShrink={0}>
          <text fg={colors.text} wrapMode="word">
            <span fg={colors.accent}>{key.algorithm}</span> {key.fingerprint}
          </text>
          <text fg={colors.muted} wrapMode="word">
            from {key.addresses.join(", ")}
          </text>
        </box>
      ))}
      {failedAddresses.length > 0 ? (
        <text fg={colors.warning} wrapMode="word">
          Could not scan {failedAddresses.join(", ")}. Connections to those nodes may still fail.
        </text>
      ) : null}
      <text fg={colors.warning} wrapMode="word">
        Only trust keys you expect from this gateway, because a wrong key can also mean the
        connection is being intercepted.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
