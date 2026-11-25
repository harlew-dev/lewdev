import type { SandboxDetails } from "@lewdev/core";

export type DetailsActionId =
  | "ssh"
  | "ssh-details"
  | "ports"
  | "toggle"
  | "restart"
  | "delete"
  | "back";

export interface DetailsMenuContext {
  status: SandboxDetails["status"];
  keyAvailable: boolean;
  sshCommandAvailable: boolean;
}

export interface DetailsMenuItem {
  id: DetailsActionId;
  label: string;
  shortcut: string;
  description: string;
  tone: "default" | "error";
  enabled: boolean;
  unavailableReason?: string;
}

const NO_KEY_REASON =
  "No private key is stored for this sandbox. Keys are only available for sandboxes lewdev created.";

/**
 * Pure action-menu model for the details screen. The renderer only paints these
 * items and the keyboard handler executes their ids.
 */
export function buildDetailsMenu(context: DetailsMenuContext): DetailsMenuItem[] {
  const running = context.status === "started";
  const transitional = context.status === "creating" || context.status === "awaiting_runtime";
  const deleted = context.status === "destroyed";

  const sshReason = !running
    ? "The sandbox must be running to connect via SSH."
    : !context.keyAvailable
      ? NO_KEY_REASON
      : !context.sshCommandAvailable
        ? "The SSH host could not be derived from the configured API URL."
        : undefined;

  const portsReason = running ? undefined : "Start the sandbox before managing ports.";
  const lifecycleReason = transitional
    ? "The sandbox is still starting. Wait for it to finish."
    : deleted
      ? "The sandbox has been deleted."
      : undefined;
  const restartReason =
    lifecycleReason ?? (running ? undefined : "The sandbox is not running. Use Start instead.");

  return [
    {
      id: "ssh",
      label: "Connect via SSH",
      shortcut: "S",
      description: "Connect to the sandbox through the AerolVM SSH gateway.",
      tone: "default",
      enabled: sshReason === undefined,
      unavailableReason: sshReason,
    },
    {
      id: "ssh-details",
      label: "View SSH details",
      shortcut: "v",
      description: "Show the gateway host, port, login user, key path, and full command.",
      tone: "default",
      enabled: true,
    },
    {
      id: "ports",
      label: "Manage ports",
      shortcut: "p",
      description: "List exposed ports, open a new one, or close one.",
      tone: "default",
      enabled: portsReason === undefined,
      unavailableReason: portsReason,
    },
    {
      id: "toggle",
      label: running ? "Stop" : "Start",
      shortcut: running ? "x" : "s",
      description: running
        ? "Stop the sandbox; its files are kept."
        : "Start the sandbox and its services.",
      tone: "default",
      enabled: lifecycleReason === undefined,
      unavailableReason: lifecycleReason,
    },
    {
      id: "restart",
      label: "Restart",
      shortcut: "R",
      description: "Stop the sandbox and start it again.",
      tone: "default",
      enabled: restartReason === undefined,
      unavailableReason: restartReason,
    },
    {
      id: "delete",
      label: "Delete sandbox",
      shortcut: "d",
      description: "Delete the sandbox and its stored key; this cannot be undone.",
      tone: "error",
      enabled: true,
    },
    {
      id: "back",
      label: "Back",
      shortcut: "esc",
      description: "Return to the sandbox list.",
      tone: "default",
      enabled: true,
    },
  ];
}

export function detailsSelectionIndex(
  items: DetailsMenuItem[],
  selectedId: DetailsActionId,
): number {
  const index = items.findIndex((item) => item.id === selectedId);
  return Math.max(index, 0);
}

export function nextDetailsSelection(
  items: DetailsMenuItem[],
  selectedIndex: number,
  delta: number,
): DetailsActionId | null {
  if (items.length === 0) {
    return null;
  }
  const current = Math.min(Math.max(selectedIndex, 0), items.length - 1);
  const next = (current + delta + items.length) % items.length;
  return items[next]?.id ?? null;
}
