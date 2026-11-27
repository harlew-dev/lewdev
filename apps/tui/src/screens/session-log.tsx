import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";

import { colors } from "../theme";

interface SessionLogScreenProps {
  sessionName: string;
  lines: string[];
  loading: boolean;
  error: string | null;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
}

export function SessionLogScreen({
  sessionName,
  lines,
  loading,
  error,
  scrollRef,
}: SessionLogScreenProps) {
  const occurrences = new Map<string, number>();
  const keyedLines = lines.map((line) => {
    const occurrence = occurrences.get(line) ?? 0;
    occurrences.set(line, occurrence + 1);
    return { key: `${line}:${occurrence}`, line };
  });

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
      overflow="hidden"
      border
      borderStyle="rounded"
      borderColor={colors.border}
      backgroundColor={colors.panel}
      title={`Output · ${sessionName}`}
      titleColor={colors.accent}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
    >
      {error ? (
        <text fg={colors.error} wrapMode="word" flexShrink={0}>
          {error}
        </text>
      ) : null}

      {loading ? (
        <text fg={colors.muted} flexShrink={0}>
          Loading session output…
        </text>
      ) : lines.length === 0 && !error ? (
        <text fg={colors.muted} flexShrink={0}>
          No output yet.
        </text>
      ) : (
        <scrollbox
          ref={scrollRef}
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          scrollY
          stickyScroll
          stickyStart="bottom"
        >
          {keyedLines.map((entry) => (
            <text key={entry.key} fg={colors.text} wrapMode="none" flexShrink={0}>
              {entry.line.length > 0 ? entry.line : " "}
            </text>
          ))}
        </scrollbox>
      )}
    </box>
  );
}
