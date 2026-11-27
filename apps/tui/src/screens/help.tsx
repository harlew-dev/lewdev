import type { ActionHint } from "../actions";
import { Panel } from "../components";
import { colors } from "../theme";

const KEY_WIDTH = 12;

function uniqueHints(hints: ActionHint[]): ActionHint[] {
  const seen = new Set<string>();
  return hints.filter(([key, label]) => {
    const id = `${key}:${label}`;
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function HintSection({ title, hints }: { title: string; hints: ActionHint[] }) {
  const rows = uniqueHints(hints);
  return (
    <box flexDirection="column" flexShrink={0}>
      <text fg={colors.accent}>{title}</text>
      {rows.length === 0 ? (
        <text fg={colors.muted}>No keys on this page.</text>
      ) : (
        rows.map(([key, label]) => (
          <box key={`${key}:${label}`} flexDirection="row" flexShrink={0} paddingLeft={1}>
            <box width={KEY_WIDTH} flexShrink={0}>
              <text fg={colors.accent}>{key}</text>
            </box>
            <text fg={colors.text}>{label}</text>
          </box>
        ))
      )}
    </box>
  );
}

export function HelpScreen({
  title,
  hints,
  globalHints,
}: {
  title: string;
  hints: ActionHint[];
  globalHints: ActionHint[];
}) {
  return (
    <scrollbox flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Help" width={74}>
        <text fg={colors.text}>Keys for {title}.</text>
        <text fg={colors.muted}>Press ? or esc to close.</text>
        <HintSection title="This page" hints={hints} />
        <HintSection title="Global" hints={globalHints} />
      </Panel>
    </scrollbox>
  );
}
