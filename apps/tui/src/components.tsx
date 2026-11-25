import type { ReactNode } from "react";

import { colors, statusColor } from "./theme";

export interface ToastMessage {
  kind: "error" | "info";
  message: string;
}

export type KeyHint = readonly [key: string, label: string];

export function Header({ right }: { right?: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={1}>
      <box flexDirection="row" gap={1}>
        <text fg={colors.accent}>lewdev</text>
        <text fg={colors.muted}>AerolVM sandbox client</text>
      </box>
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
  if (!toast) {
    return null;
  }
  const isError = toast.kind === "error";
  return (
    <box flexShrink={0} paddingTop={1}>
      <text fg={isError ? colors.error : colors.success} wrapMode="word">
        {isError ? "! " : "i "}
        {toast.message}
      </text>
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
}

export function Field({
  label,
  value,
  active = false,
  masked = false,
  placeholder,
  display,
}: FieldProps) {
  const shown =
    display ??
    (value.length > 0 ? (masked ? "•".repeat(Math.min([...value].length, 48)) : value) : "");
  return (
    <box flexDirection="row" height={1} flexShrink={0}>
      <box width={14} flexShrink={0}>
        <text fg={active ? colors.accent : colors.muted}>{label}</text>
      </box>
      <text fg={shown.length > 0 ? colors.text : colors.muted}>
        {shown.length > 0 ? shown : (placeholder ?? "")}
      </text>
      {active ? <text fg={colors.accent}>▌</text> : null}
    </box>
  );
}

export function StatusText({ status, label }: { status: string; label?: string }) {
  return <text fg={statusColor(status)}>{label ?? status}</text>;
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

export function ConfirmDialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center">
      <box
        width={64}
        maxWidth="100%"
        border
        borderStyle="double"
        borderColor={colors.error}
        backgroundColor={colors.panel}
        title={title}
        titleColor={colors.error}
        flexDirection="column"
        padding={2}
        gap={1}
      >
        {children}
      </box>
    </box>
  );
}
