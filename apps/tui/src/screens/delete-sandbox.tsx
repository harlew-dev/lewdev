import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface DeleteSandboxScreenProps {
  id: string;
  label: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function DeleteSandboxScreen({
  id,
  label,
  actions,
  selectedIndex,
}: DeleteSandboxScreenProps) {
  return (
    <Panel title="Delete sandbox" width={70}>
      <text fg={colors.text}>
        Delete <span fg={colors.accent}>{label}</span>?
      </text>
      <text fg={colors.muted}>{id}</text>
      <text fg={colors.warning} wrapMode="word">
        This also removes the private key lewdev stored for it. The action cannot be undone.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
