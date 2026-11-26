import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface ConfirmCreateSnapshotScreenProps {
  label: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function ConfirmCreateSnapshotScreen({
  label,
  actions,
  selectedIndex,
}: ConfirmCreateSnapshotScreenProps) {
  return (
    <Panel title="Create snapshot" width={70}>
      <text fg={colors.text}>
        Snapshot <span fg={colors.accent}>{label}</span>?
      </text>
      <text fg={colors.warning} wrapMode="word">
        The sandbox pauses briefly while its disk is copied, then keeps running. Large disks can
        take a while.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
