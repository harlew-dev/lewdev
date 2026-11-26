import type { UsageMetric, UsageSummary } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { ActionGroup, ActionHint, PageAction } from "./actions";
import { dockerfilePreviewLines, pastedDockerfileLines } from "./create-form";
import { shortStatus, truncate } from "./format";
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

export function SegmentedRow({
  label,
  options,
  selected,
  active,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string;
  active: boolean;
}) {
  return (
    <box flexDirection="row" flexShrink={0} gap={1} alignItems="center">
      <box width={14} flexShrink={0}>
        <text fg={active ? colors.accent : colors.muted}>{label}</text>
      </box>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <box
            key={option.id}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={isSelected ? colors.selection : colors.panelAlt}
          >
            <text fg={isSelected ? colors.accent : colors.muted}>{option.label}</text>
          </box>
        );
      })}
      <text fg={colors.muted}>←/→</text>
    </box>
  );
}

export function DockerfileContents({ contents, active }: { contents: string; active: boolean }) {
  const lines = dockerfilePreviewLines(contents);
  const count = pastedDockerfileLines(contents);
  const occurrences = new Map<string, number>();
  return (
    <box flexDirection="column" flexShrink={0}>
      <box
        border
        borderStyle="rounded"
        borderColor={active ? colors.accent : colors.border}
        title="Contents"
        titleColor={active ? colors.accent : colors.muted}
        backgroundColor={colors.panel}
        flexDirection="column"
        flexShrink={0}
        overflow="hidden"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {lines.length === 0 ? (
          <text fg={colors.muted}>paste or type a Dockerfile</text>
        ) : (
          lines.map((line) => {
            const occurrence = occurrences.get(line) ?? 0;
            occurrences.set(line, occurrence + 1);
            return (
              <text key={`${line}:${occurrence}`} fg={colors.text} wrapMode="none">
                {line.length > 0 ? line : " "}
              </text>
            );
          })
        )}
      </box>
      <text fg={colors.muted}>{plural(count, "line", "lines")}</text>
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

function usageGigabytes(memoryMB: number): string {
  const gb = memoryMB / 1024;
  return Number.isInteger(gb) ? String(gb) : String(Number(gb.toFixed(1)));
}

function metricColor(metric: UsageMetric): string {
  if (metric.level === "error") {
    return colors.error;
  }
  if (metric.level === "warning") {
    return colors.warning;
  }
  return colors.muted;
}

function metricText(
  metric: UsageMetric,
  suffix: string,
  format: (value: number) => string,
): string {
  const used = format(metric.used);
  return metric.limit === undefined
    ? `${used} ${suffix}`
    : `${used}/${format(metric.limit)} ${suffix}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const USAGE_SEPARATOR = " · ";
const TEAM_MAX = 24;

export function UsageBar({
  summary,
  updateVersion,
}: {
  summary: UsageSummary;
  updateVersion?: string;
}) {
  const { width } = useTerminalDimensions();
  const segments: Array<{ text: string; color: string }> = [];

  if (summary.quota) {
    const quota = summary.quota;
    segments.push({
      text: `${metricText(quota.sandboxes, "sandboxes", String)} (${summary.running} running)`,
      color: metricColor(quota.sandboxes),
    });
    segments.push({
      text: metricText(quota.cpu, "CPU", String),
      color: metricColor(quota.cpu),
    });
    segments.push({
      text: metricText(quota.memoryMB, "GB memory", usageGigabytes),
      color: metricColor(quota.memoryMB),
    });
  } else {
    segments.push({
      text: `${plural(summary.sandboxes, "sandbox", "sandboxes")} (${summary.running} running)`,
      color: colors.muted,
    });
    segments.push({ text: `${summary.cpu} CPU`, color: colors.muted });
    segments.push({ text: `${usageGigabytes(summary.memoryMB)} GB memory`, color: colors.muted });
  }
  segments.push({ text: `${summary.diskGB} GB disk`, color: colors.muted });
  if (summary.snapshots !== null) {
    segments.push({
      text: plural(summary.snapshots, "snapshot", "snapshots"),
      color: colors.muted,
    });
  }

  // Keep the bar on one line: drop the team first, then the update marker,
  // then trailing segments.
  const available = Math.max(0, width - 2);
  const teamText = summary.team ? `team ${truncate(summary.team, TEAM_MAX)}` : "";
  const updateText = updateVersion ? `↑ ${updateVersion}` : "";
  const lengthOf = (list: typeof segments) =>
    list.reduce((total, segment, index) => total + segment.text.length + (index > 0 ? 3 : 0), 0);
  let shown = segments;
  let showTeam = teamText.length > 0;
  let showUpdate = updateText.length > 0;
  const rightLength = () => {
    let total = 0;
    if (showUpdate) {
      total += updateText.length;
    }
    if (showTeam) {
      total += teamText.length + (showUpdate ? 1 : 0);
    }
    return total;
  };
  while (lengthOf(shown) + (rightLength() > 0 ? rightLength() + 2 : 0) > available) {
    if (showTeam) {
      showTeam = false;
    } else if (showUpdate) {
      showUpdate = false;
    } else if (shown.length > 1) {
      shown = shown.slice(0, -1);
    } else {
      break;
    }
  }

  return (
    <box flexDirection="row" justifyContent="space-between" flexShrink={0} height={1}>
      <text wrapMode="none">
        {shown.map((segment, index) => (
          <span key={segment.text}>
            <span fg={segment.color}>{segment.text}</span>
            {index < shown.length - 1 ? <span fg={colors.muted}>{USAGE_SEPARATOR}</span> : null}
          </span>
        ))}
      </text>
      <box flexDirection="row" gap={1}>
        {showUpdate ? (
          <text fg={colors.accent} wrapMode="none">
            {updateText}
          </text>
        ) : null}
        {showTeam ? (
          <text fg={colors.muted} wrapMode="none">
            {teamText}
          </text>
        ) : null}
      </box>
    </box>
  );
}

export function HomeTabs({ active }: { active: "sandboxes" | "snapshots" }) {
  const tabs = [
    { id: "sandboxes" as const, label: "Sandboxes" },
    { id: "snapshots" as const, label: "Snapshots" },
  ];
  return (
    <box flexDirection="row" flexShrink={0} gap={1}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <box
            key={tab.id}
            paddingLeft={2}
            paddingRight={2}
            backgroundColor={selected ? colors.selection : colors.panelAlt}
          >
            <text fg={selected ? colors.accent : colors.muted}>{tab.label}</text>
          </box>
        );
      })}
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
