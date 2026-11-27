import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface RemoveCustomDomainScreenProps {
  hostname: string;
  error: string | null;
  actions: PageAction[];
  selectedIndex: number;
}

export function RemoveCustomDomainScreen({
  hostname,
  error,
  actions,
  selectedIndex,
}: RemoveCustomDomainScreenProps) {
  return (
    <Panel title="Remove custom domain" width={72}>
      <text fg={colors.text} wrapMode="word">
        Remove <span fg={colors.accent}>{hostname}</span>?
      </text>
      <text fg={colors.muted} wrapMode="word">
        Traffic to this hostname stops and its certificate binding is dropped. DNS records you
        created at your provider are not changed.
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
