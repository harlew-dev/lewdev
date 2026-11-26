import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface EnablePublicSshScreenProps {
  label: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function EnablePublicSshScreen({
  label,
  actions,
  selectedIndex,
}: EnablePublicSshScreenProps) {
  return (
    <Panel title="Enable public TCP SSH" width={82}>
      <text fg={colors.text} wrapMode="word">
        Expose TCP port 22 for <span fg={colors.accent}>{label}</span>?
      </text>
      <text fg={colors.warning} wrapMode="word">
        The port will be reachable from the internet by anyone who can reach the host. Login stays
        key-only for root, and the private key remains on this computer.
      </text>
      <text fg={colors.muted} wrapMode="word">
        lewdev starts sshd, exposes port 22, and switches the SSH config block to HostName/Port. Use
        this for machines that do not have lewdev installed.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
