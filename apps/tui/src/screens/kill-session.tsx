import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface KillSessionScreenProps {
  sessionName: string;
  error: string | null;
  actions: PageAction[];
  selectedIndex: number;
}

export function KillSessionScreen({
  sessionName,
  error,
  actions,
  selectedIndex,
}: KillSessionScreenProps) {
  return (
    <Panel title="Kill session" width={70}>
      <text fg={colors.text} wrapMode="word">
        Kill <span fg={colors.accent}>{sessionName}</span>?
      </text>
      <text fg={colors.warning} wrapMode="word">
        The program stops at once and the session&apos;s output is removed. This cannot be undone.
      </text>
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
