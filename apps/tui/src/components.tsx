import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { ActionGroup, ActionHint, PageAction } from "./actions";
import { shortStatus } from "./format";
import { colors, statusColor, statusTint, tints, type ToastTint } from "./theme";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  kind: ToastKind;
  message: string;
}

export type KeyHint = ActionHint;

const TOAST_STYLE: Record<ToastKind, { icon: string; color: string; background: ToastTint }> = {
  success: { icon: "✓", color: colors.success, background: "success" },
  error: { icon: "✕", color: colors.error, background: "error" },
  warning: { icon: "!", color: colors.warning, background: "warning" },
  info: { icon: "i", color: colors.accent, background: "info" },
};

function charLength(value: string): number {
  return [...value].length;
}

function takeChars(value: string, count: number): string {
  return [...value].slice(0, count).join("");
}

/**
 * Wraps a toast message to at most two lines for the available width. Longer
 * text is cut at a word boundary and ends with an ellipsis.
 */
export function wrapToastMessage(message: string, width: number): string[] {
  const available = Math.max(8, width - 6);
  const words = message.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (charLength(candidate) <= available) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (charLength(word) <= available) {
      line = word;
      continue;
    }
    let rest = word;
    while (charLength(rest) > available) {
      lines.push(takeChars(rest, available));
      rest = [...rest].slice(available).join("");
    }
    line = rest;
  }
  if (line) {
    lines.push(line);
  }
  if (lines.length === 0) {
    return [""];
  }
  if (lines.length <= 2) {
    return lines;
  }
  return [lines[0] ?? "", `${takeChars(lines[1] ?? "", Math.max(1, available - 1))}…`];
}

export function Header({ breadcrumbs = [], right }: { breadcrumbs?: string[]; right?: string }) {
  const crumbs = breadcrumbs.map((crumb, index) => ({
    crumb,
    key: breadcrumbs.slice(0, index + 1).join(" › "),
    current: index === breadcrumbs.length - 1,
  }));
  return (
    <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={1}>
      <text>
        <span fg={colors.accent}>lewdev</span>
        {crumbs.length === 0 ? (
          <span fg={colors.muted}> AerolVM sandbox client</span>
        ) : (
          crumbs.map((entry) => (
            <span key={entry.key}>
              <span fg={colors.muted}> › </span>
              <span fg={entry.current ? colors.accent : colors.text}>{entry.crumb}</span>
            </span>
          ))
        )}
      </text>
      {right ? <text fg={colors.muted}>{right}</text> : null}
    </box>
  );
}

export function KeyHints({ hints }: { hints: KeyHint[] }) {
  return (
    <box flexDirection="row" flexWrap="wrap" columnGap={2} paddingTop={1} flexShrink={0}>
      {hints.map(([key, label]) => (
        <box key={`${key}:${label}`} flexDirection="row" gap={1}>
          <text fg={colors.accent}>{key}</text>
          <text fg={colors.muted}>{label}</text>
        </box>
      ))}
    </box>
  );
}

export function ToastLine({ toast }: { toast: ToastMessage | null }) {
  const { width } = useTerminalDimensions();
  if (!toast) {
    return null;
  }
  const style = TOAST_STYLE[toast.kind];
  const lines = wrapToastMessage(toast.message, width);
  return (
    <box
      width="100%"
      flexShrink={0}
      flexDirection="column"
      backgroundColor={tints[style.background]}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={style.color} wrapMode="none">
        {style.icon} {lines[0] ?? ""}
      </text>
      {lines[1] ? (
        <text fg={style.color} wrapMode="none">
          {"  "}
          {lines[1]}
        </text>
      ) : null}
    </box>
  );
}

export function BusyLine({ message, frame }: { message: string | null; frame: string }) {
  if (!message) {
    return null;
  }
  return (
    <box flexShrink={0} paddingTop={1}>
      <text fg={colors.accent}>
        {frame} {message}
      </text>
    </box>
  );
}

interface FieldProps {
  label: string;
  value: string;
  active?: boolean;
  masked?: boolean;
  placeholder?: string;
  display?: string;
  /** Right-aligned text inside the box, such as a dropdown chevron. */
  trailing?: string;
  /** Show the text cursor when the field is focused (default true). */
  cursor?: boolean;
}

export function Field({
  label,
  value,
  active = false,
  masked = false,
  placeholder,
  display,
  trailing,
  cursor = true,
}: FieldProps) {
  const shown =
    display ??
    (value.length > 0 ? (masked ? "•".repeat(Math.min([...value].length, 48)) : value) : "");
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={active ? colors.accent : colors.border}
      title={label}
      titleColor={active ? colors.accent : colors.muted}
      flexDirection="row"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.panel}
    >
      <box flexGrow={1} flexDirection="row">
        <text fg={shown.length > 0 ? colors.text : colors.muted}>
          {shown.length > 0 ? shown : (placeholder ?? "")}
        </text>
        {active && cursor ? <text fg={colors.accent}>▌</text> : null}
      </box>
      {trailing ? <text fg={active ? colors.accent : colors.muted}>{trailing}</text> : null}
    </box>
  );
}

export function FormButton({ label, active }: { label: string; active: boolean }) {
  return (
    <box
      flexDirection="row"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={active ? colors.selection : colors.panelAlt}
    >
      <text fg={active ? colors.accent : colors.text}>{label}</text>
    </box>
  );
}

export function StatusText({ status, label }: { status: string; label?: string }) {
  return (
    <box
      flexShrink={0}
      alignSelf="flex-start"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={statusTint(status)}
    >
      <text fg={statusColor(status)}>● {label ?? shortStatus(status)}</text>
    </box>
  );
}

export function Panel({
  title,
  children,
  width = 72,
}: {
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={1} paddingBottom={1}>
      <box
        width={width}
        maxWidth="100%"
        border
        borderStyle="rounded"
        borderColor={colors.border}
        backgroundColor={colors.panel}
        title={title}
        titleColor={colors.accent}
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        gap={1}
      >
        {children}
      </box>
    </box>
  );
}

export function ActionList({
  groups,
  selectedIndex,
}: {
  groups: ActionGroup[];
  selectedIndex: number;
}) {
  let actionIndex = -1;
  return (
    <box flexDirection="column" flexShrink={0}>
      {groups.map((group, groupIndex) => {
        const groupKey = group.title ?? group.actions.map((entry) => entry.id).join("-");
        return (
          <box key={groupKey} flexDirection="column" flexShrink={0}>
            {groupIndex > 0 ? <box height={1} /> : null}
            {group.title ? (
              <box paddingLeft={1}>
                <text fg={colors.muted}>{group.title}</text>
              </box>
            ) : null}
            {group.ports?.map((port) => (
              <box key={port.id} flexDirection="row" flexShrink={0} paddingLeft={1}>
                <box width={2}>
                  <text> </text>
                </box>
                <box width={8}>
                  <text fg={colors.muted}>{port.port}</text>
                </box>
                <box width={10}>
                  <text fg={port.visibility === "token" ? colors.warning : colors.success}>
                    {port.visibility}
                  </text>
                </box>
                <box flexGrow={1}>
                  <text fg={colors.muted} selectable>
                    {port.url}
                  </text>
                </box>
              </box>
            ))}
            {group.note ? (
              <box flexDirection="row" flexShrink={0} paddingLeft={1}>
                <box width={2}>
                  <text> </text>
                </box>
                <text fg={colors.muted}>{group.note}</text>
              </box>
            ) : null}
            {group.actions.map((item) => {
              actionIndex += 1;
              const isSelected = actionIndex === selectedIndex;
              const labelColor = !item.enabled
                ? colors.muted
                : item.tone === "error"
                  ? colors.error
                  : isSelected
                    ? colors.accent
                    : colors.text;
              return (
                <box
                  key={item.id}
                  id={`action-${item.id}`}
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
                  <box flexGrow={1}>
                    <text fg={labelColor}>{item.label}</text>
                  </box>
                </box>
              );
            })}
          </box>
        );
      })}
    </box>
  );
}

export function selectedAction(
  groups: ActionGroup[],
  selectedIndex: number,
): PageAction | undefined {
  return groups.flatMap((group) => group.actions)[selectedIndex];
}

/**
 * Clips a long grouped action list to the space the page leaves below its info
 * card and keeps the selected action in view.
 */
export function ActionScroller({
  groups,
  selectedIndex,
}: {
  groups: ActionGroup[];
  selectedIndex: number;
}) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const selectedId = selectedAction(groups, selectedIndex)?.id;

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    scrollRef.current?.scrollChildIntoView(`action-${selectedId}`, { align: "nearest" });
  }, [selectedId]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <ActionList groups={groups} selectedIndex={selectedIndex} />
    </scrollbox>
  );
}
