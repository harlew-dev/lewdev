import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface SshIncludeScreenProps {
  configPath: string;
  includeLine: string;
  homeConfigPath: string;
  actions: PageAction[];
  selectedIndex: number;
}

export function SshIncludeScreen({
  configPath,
  includeLine,
  homeConfigPath,
  actions,
  selectedIndex,
}: SshIncludeScreenProps) {
  return (
    <Panel title="Allow lewdev's SSH config" width={84}>
      <text fg={colors.text} wrapMode="word">
        lewdev keeps its sandbox entries in <span fg={colors.accent}>{configPath}</span>. To make
        <span fg={colors.accent}> ssh lewdev-&lt;id&gt;</span> work, it needs one Include line at
        the top of <span fg={colors.accent}>{homeConfigPath}</span>.
      </text>
      <text fg={colors.text} wrapMode="word">
        {includeLine}
      </text>
      <text fg={colors.muted} wrapMode="word">
        Nothing else in that file is changed, and the line is added only once. lewdev never edits
        ~/.ssh/known_hosts.
      </text>
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
