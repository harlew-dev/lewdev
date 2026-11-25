import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface ForgetHostScreenProps {
  entry: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function ForgetHostScreen({ entry, actions, selectedIndex }: ForgetHostScreenProps) {
  return (
    <Panel title="Forget host key" width={74}>
      <text fg={colors.text} wrapMode="word">
        Remove the saved key for <span fg={colors.accent}>{entry}</span> from lewdev&apos;s
        known_hosts.
      </text>
      <text fg={colors.muted} wrapMode="word">
        This applies to every sandbox on this gateway.
      </text>
      <text fg={colors.muted} wrapMode="word">
        The next connection shows the server&apos;s fingerprint and asks you to trust it.
      </text>
      <text fg={colors.warning} wrapMode="word">
        Only do this if you expect the server&apos;s key changed, because a changed key can also
        mean the connection is being intercepted.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
