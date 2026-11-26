import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface DeleteSnapshotScreenProps {
  name: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function DeleteSnapshotScreen({ name, actions, selectedIndex }: DeleteSnapshotScreenProps) {
  return (
    <Panel title="Delete snapshot" width={70}>
      <text fg={colors.text}>
        Delete snapshot <span fg={colors.accent}>{name}</span>?
      </text>
      <text fg={colors.warning} wrapMode="word">
        Any sandbox already booted from it keeps running, but the snapshot cannot be used again.
        This action cannot be undone.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
