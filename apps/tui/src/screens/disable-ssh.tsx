import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface DisableSshScreenProps {
  label: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function DisableSshScreen({ label, actions, selectedIndex }: DisableSshScreenProps) {
  return (
    <Panel title="Disable SSH" width={76}>
      <text fg={colors.text} wrapMode="word">
        Disable direct SSH for <span fg={colors.accent}>{label}</span>?
      </text>
      <text fg={colors.muted} wrapMode="word">
        lewdev closes TCP port 22, stops sshd, and removes this sandbox from its SSH config. The key
        and root&apos;s authorized_keys are kept, so Set up SSH can restore access later.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
