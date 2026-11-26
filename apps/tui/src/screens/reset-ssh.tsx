import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface ResetSshScreenProps {
  label: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function ResetSshScreen({ label, actions, selectedIndex }: ResetSshScreenProps) {
  return (
    <Panel title="Reset SSH" width={82}>
      <text fg={colors.text} wrapMode="word">
        Reset direct SSH for <span fg={colors.accent}>{label}</span>?
      </text>
      <text fg={colors.muted} wrapMode="word">
        Use this after the sandbox was wiped or reinstalled. lewdev tries to remove its old public
        key from root&apos;s authorized_keys, deletes its local SSH state for this sandbox, then
        runs the normal Set up SSH flow. That generates a fresh lewdev key.
      </text>
      <text fg={colors.muted} wrapMode="word">
        Other authorized keys are kept. Removing the old key is best effort because a wiped sandbox
        may no longer have it.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
