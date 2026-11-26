import type { SandboxFileEntry } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { Field, Panel } from "../components";
import { colors } from "../theme";

interface VscodeDirectoryScreenProps {
  currentDir: string;
  pathInput: string;
  entries: SandboxFileEntry[];
  truncated: boolean;
  loading: boolean;
  error: string | null;
  selected: number;
  showHidden: boolean;
}

export function VscodeDirectoryScreen({
  currentDir,
  pathInput,
  entries,
  truncated,
  loading,
  error,
  selected,
  showHidden,
}: VscodeDirectoryScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const showParent = currentDir !== "/";

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`vscode-row-${selected}`, { align: "nearest" });
  }, [selected]);

  const rows: Array<{ id: string; label: string; muted?: boolean }> = [
    { id: "open", label: `Open ${currentDir} in VS Code` },
    ...(showParent ? [{ id: "parent", label: ".." }] : []),
    ...entries.map((entry) => ({
      id: `dir-${entry.path}`,
      label: entry.symlinkTarget ? `${entry.name} →` : entry.name,
    })),
  ];

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Select directory" width={86}>
        <Field label="Path" value={pathInput} active placeholder="/root" />
        <text fg={colors.muted} wrapMode="word">
          Type a path and press enter to go there, or use ↑/↓ and enter. Hidden folders:{" "}
          {showHidden ? "shown" : "hidden"} (ctrl+t toggles).
        </text>
        {loading ? <text fg={colors.accent}>Loading folders…</text> : null}
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}
        {truncated ? (
          <text fg={colors.warning} wrapMode="word">
            The folder listing was truncated; only the first 2000 entries are shown.
          </text>
        ) : null}
        <box flexDirection="column" flexShrink={0}>
          {rows.map((row, index) => {
            const isSelected = index === selected;
            return (
              <box
                key={row.id}
                id={`vscode-row-${index}`}
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
                <text
                  fg={isSelected ? colors.accent : row.muted ? colors.muted : colors.text}
                  wrapMode="word"
                >
                  {row.label}
                </text>
              </box>
            );
          })}
          {!loading && rows.length === 1 && !error ? (
            <text fg={colors.muted}>No subfolders.</text>
          ) : null}
        </box>
      </Panel>
    </scrollbox>
  );
}
