import type { AuthorizedKey } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

interface RemoveSshKeyScreenProps {
  keys: AuthorizedKey[];
  selected: number;
  loading: boolean;
  error: string | null;
  actions: PageAction[];
  selectedIndex: number;
}

export function RemoveSshKeyScreen({
  keys,
  selected,
  loading,
  error,
  actions,
  selectedIndex,
}: RemoveSshKeyScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const active = keys[selected];

  useEffect(() => {
    if (active) {
      scrollRef.current?.scrollChildIntoView(`key-${selected}`, { align: "nearest" });
    }
  }, [active, selected]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Remove SSH key" width={84}>
        <text fg={colors.text} wrapMode="word">
          Remove one key from root&apos;s authorized_keys. The private key on your computer is not
          touched.
        </text>
        {loading ? <text fg={colors.muted}>Loading authorized keys…</text> : null}
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}
        {!loading && !error && keys.length === 0 ? (
          <text fg={colors.muted}>Root has no SSH keys.</text>
        ) : null}
        <box flexDirection="column" flexShrink={0}>
          {keys.map((key, index) => {
            const isSelected = index === selected;
            return (
              <box
                key={key.fingerprint}
                id={`key-${index}`}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={2}>
                  <text fg={isSelected ? colors.accent : colors.muted}>
                    {isSelected ? "›" : " "}
                  </text>
                </box>
                <box flexDirection="column" flexGrow={1}>
                  <text fg={isSelected ? colors.accent : colors.text} wrapMode="word">
                    {key.type}
                    {key.comment ? ` ${key.comment}` : ""}
                    {key.isLewdev ? "  (lewdev)" : ""}
                  </text>
                  <text fg={colors.muted} wrapMode="word">
                    {key.fingerprint}
                  </text>
                </box>
              </box>
            );
          })}
        </box>
        {active?.isLewdev ? (
          <text fg={colors.warning} wrapMode="word">
            This is lewdev&apos;s own key. Removing it stops lewdev from connecting until you run
            Set up SSH again.
          </text>
        ) : null}
        <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
      </Panel>
    </scrollbox>
  );
}
