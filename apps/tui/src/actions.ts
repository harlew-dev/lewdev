import type { SandboxDetails } from "@lewdev/core";

export type ActionId =
  | "open"
  | "start"
  | "stop"
  | "restart"
  | "ssh"
  | "ssh-info"
  | "ports"
  | "delete"
  | "new"
  | "connect"
  | "open-port"
  | "close-port"
  | "copy-ssh"
  | "forget-host"
  | "confirm-forget"
  | "confirm-delete"
  | "submit"
  | "paste"
  | "back"
  | "quit";

export type ActionTone = "default" | "error";

export type ActionHint = readonly [key: string, label: string];

export interface PageAction {
  id: ActionId;
  label: string;
  /** Short label used in the footer hints. */
  hint: string;
  /** Optional key that triggers this action directly, e.g. "enter" or "esc". */
  key?: string;
  description: string;
  tone: ActionTone;
  enabled: boolean;
  unavailableReason?: string;
}

export interface ActionPortRow {
  id: string;
  port: number;
  visibility: "public" | "token";
  url: string;
}

export interface ActionGroup {
  /** Muted section header; omitted for the first group. */
  title?: string;
  /** Display-only port rows rendered above the group's actions. */
  ports?: ActionPortRow[];
  /** Muted display-only line, e.g. "No ports open". */
  note?: string;
  actions: PageAction[];
}

const NO_KEY_REASON =
  "No private key is stored for this sandbox. Keys are only available for sandboxes lewdev created.";
const LOADING_REASON = "The sandbox details are still loading.";
const TRANSITIONAL_REASON = "The sandbox is still starting. Wait for it to finish.";
const DELETED_REASON = "The sandbox has been deleted.";

export interface SandboxActionContext {
  status: SandboxDetails["status"] | null;
  keyAvailable: boolean;
  sshCommandAvailable: boolean;
}

interface SandboxReasons {
  ssh?: string;
  ports?: string;
  start?: string;
  stop?: string;
  restart?: string;
}

/**
 * Shared availability rules for every action that targets one sandbox. A null
 * status means the details have not arrived yet.
 */
function sandboxReasons(context: SandboxActionContext): SandboxReasons {
  const { status } = context;
  const loading = status === null;
  const running = status === "started";
  const transitional = status === "creating" || status === "awaiting_runtime";
  const deleted = status === "destroyed";

  const blocked = loading
    ? LOADING_REASON
    : transitional
      ? TRANSITIONAL_REASON
      : deleted
        ? DELETED_REASON
        : undefined;

  const sshReason =
    blocked ??
    (!running
      ? "The sandbox must be running to connect via SSH."
      : !context.keyAvailable
        ? NO_KEY_REASON
        : !context.sshCommandAvailable
          ? "The SSH host could not be derived from the configured API URL."
          : undefined);

  const portsReason = blocked ?? (running ? undefined : "Start the sandbox before managing ports.");

  const startReason = blocked ?? (running ? "The sandbox is already running." : undefined);

  const stopReason =
    blocked ??
    (running
      ? undefined
      : status === "stopped" || status === "passivated"
        ? "The sandbox is already stopped."
        : "The sandbox is not running.");

  const restartReason =
    blocked ?? (running ? undefined : "The sandbox is not running. Use Start instead.");

  return {
    ssh: sshReason,
    ports: portsReason,
    start: startReason,
    stop: stopReason,
    restart: restartReason,
  };
}

function action(
  id: ActionId,
  label: string,
  hint: string,
  key: string | undefined,
  description: string,
  reason: string | undefined,
  tone: ActionTone = "default",
): PageAction {
  return {
    id,
    label,
    hint,
    ...(key === undefined ? {} : { key }),
    description,
    tone,
    enabled: reason === undefined,
    ...(reason === undefined ? {} : { unavailableReason: reason }),
  };
}

/** Actions for the Sandboxes list page, acting on the highlighted sandbox. */
export function buildSandboxListActions(): PageAction[] {
  return [
    action("open", "Open sandbox", "select", "enter", "Open the highlighted row.", undefined),
    action("new", "New sandbox", "new", "n", "Create a sandbox from an image.", undefined),
    action(
      "connect",
      "Connect / settings",
      "connect",
      "c",
      "Change the API URL and token.",
      undefined,
    ),
    action("quit", "Quit", "quit", "q", "Close lewdev.", undefined),
  ];
}

/** Actions on a sandbox page, in the order the grouped list shows them. */
export function buildSandboxPageActions(context: SandboxActionContext): PageAction[] {
  const reasons = sandboxReasons(context);

  return [
    action(
      "start",
      "Start",
      "start",
      undefined,
      "Start the sandbox and its services.",
      reasons.start,
    ),
    action(
      "stop",
      "Stop",
      "stop",
      undefined,
      "Stop the sandbox; its files are kept.",
      reasons.stop,
    ),
    action(
      "restart",
      "Restart",
      "restart",
      undefined,
      "Stop the sandbox and start it again.",
      reasons.restart,
    ),
    action(
      "delete",
      "Delete sandbox",
      "delete",
      undefined,
      "Delete the sandbox and its stored key; this cannot be undone.",
      undefined,
      "error",
    ),
    action(
      "ssh",
      "Open terminal",
      "open terminal",
      undefined,
      "Open an SSH session in an embedded terminal.",
      reasons.ssh,
    ),
    action(
      "ssh-info",
      "Settings",
      "settings",
      undefined,
      "Show the SSH host, key path, known hosts file, and saved host key.",
      undefined,
    ),
    action(
      "ports",
      "Manage ports",
      "ports",
      undefined,
      "List exposed ports, open a new one, or close one.",
      reasons.ports,
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox list.", undefined),
  ];
}

/**
 * Groups the sandbox page actions for rendering. Headers and port rows are
 * display-only; navigation walks the actions in the same order they appear.
 */
export function buildSandboxPageGroups(
  actions: PageAction[],
  ports: SandboxDetails["exposedPorts"],
): ActionGroup[] {
  const collect = (ids: ActionId[]): PageAction[] =>
    ids.flatMap((id) => {
      const entry = actions.find((candidate) => candidate.id === id);
      return entry ? [entry] : [];
    });

  const portRows: ActionPortRow[] = ports.map((port) => ({
    id: `port-${port.port}`,
    port: port.port,
    visibility: port.visibility === "token" ? "token" : "public",
    url: port.url,
  }));

  return [
    { actions: collect(["start", "stop", "restart", "delete"]) },
    { title: "SSH", actions: collect(["ssh", "ssh-info"]) },
    {
      title: "Ports",
      ...(portRows.length > 0 ? { ports: portRows } : { note: "No ports open" }),
      actions: collect(["ports"]),
    },
    { actions: collect(["back"]) },
  ];
}

/** Actions on the SSH settings page. */
export function buildSshDetailsActions(context: { canForgetHost: boolean }): PageAction[] {
  return [
    action(
      "copy-ssh",
      "Copy SSH command",
      "copy ssh",
      undefined,
      "Copy the full ssh command to the system clipboard.",
      undefined,
    ),
    action(
      "forget-host",
      "Forget saved host key",
      "forget host key",
      undefined,
      "Remove the saved gateway key so the next connection asks to trust it again.",
      context.canForgetHost
        ? undefined
        : "The SSH host could not be derived from the configured API URL.",
      "error",
    ),
    action("back", "Back", "back", "esc", "Return to the previous page.", undefined),
  ];
}

/** Actions on the forget-host-key confirmation page. */
export function buildForgetHostActions(): PageAction[] {
  return [
    action(
      "confirm-forget",
      "Forget host key",
      "forget",
      undefined,
      "Remove the saved gateway key from lewdev's known_hosts.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the saved host key.", undefined),
  ];
}

/** Actions on the Ports page; x acts on the selected port. */
export function buildPortsPageActions(context: {
  hasPorts: boolean;
  hasSelectedPort: boolean;
}): PageAction[] {
  return [
    action(
      "open-port",
      "Open port",
      "open port",
      "o",
      "Expose another port on the sandbox.",
      undefined,
    ),
    action(
      "close-port",
      "Close port",
      "close port",
      "x",
      "Stop exposing the selected port.",
      context.hasSelectedPort
        ? undefined
        : context.hasPorts
          ? "Select a port first."
          : "There are no open ports to close.",
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the Open port form page. */
export function buildOpenPortActions(): PageAction[] {
  return [
    action(
      "submit",
      "Open port",
      "open port",
      "enter",
      "Expose the port once both fields are filled in.",
      undefined,
    ),
    action(
      "paste",
      "Paste from clipboard",
      "paste",
      "ctrl+v",
      "Paste a port number into the focused field.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to the ports list.", undefined),
  ];
}

/** Actions on the delete confirmation page. */
export function buildDeleteActions(): PageAction[] {
  return [
    action(
      "confirm-delete",
      "Delete",
      "delete",
      undefined,
      "Delete the sandbox and the private key lewdev stored for it.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the sandbox.", undefined),
  ];
}

/** Actions on the Connect page. */
export function buildConnectActions(context: { canGoBack: boolean }): PageAction[] {
  return [
    action(
      "submit",
      "Save & connect",
      "verify & save",
      "enter",
      "Check the server, then save the URL and token.",
      undefined,
    ),
    action(
      "paste",
      "Paste from clipboard",
      "paste",
      "ctrl+v",
      "Paste into the focused field.",
      undefined,
    ),
    action(
      "back",
      "Back",
      "back",
      "esc",
      "Return to the previous page.",
      context.canGoBack ? undefined : "Connect to a server first.",
    ),
  ];
}

/** Actions on the New sandbox form page. */
export function buildNewSandboxActions(): PageAction[] {
  return [
    action(
      "submit",
      "Create sandbox",
      "create",
      "enter",
      "Create the sandbox with the entered values.",
      undefined,
    ),
    action(
      "paste",
      "Paste from clipboard",
      "paste",
      "ctrl+v",
      "Paste into the focused field.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to the sandbox list.", undefined),
  ];
}

export interface ActionKeyLike {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

/**
 * Normalises a key event to the string used by `PageAction.key`. Returns null
 * for keys that are not action keys (arrows, tab, plain typing helpers).
 */
export function actionKey(key: ActionKeyLike): string | null {
  // Ctrl+] reaches the parser as the raw escape byte, sometimes without ctrl.
  if (key.sequence === "\x1d") {
    return "ctrl+]";
  }
  if (key.ctrl) {
    const name = key.name.toLowerCase();
    if (name === "v") {
      return "ctrl+v";
    }
    if (name === "]") {
      return "ctrl+]";
    }
    return null;
  }
  if (key.meta) {
    return null;
  }
  if (key.name === "return" || key.name === "enter") {
    return "enter";
  }
  if (key.name === "escape") {
    return "esc";
  }
  if (key.name.length === 1) {
    const lower = key.name.toLowerCase();
    if (!/[a-z]/.test(lower)) {
      return lower;
    }
    const sequenceIsUpper =
      key.sequence.length === 1 &&
      key.sequence !== lower &&
      key.sequence === key.sequence.toUpperCase();
    return key.shift || sequenceIsUpper ? lower.toUpperCase() : lower;
  }
  return null;
}

export function findActionForKey(
  actions: PageAction[],
  pressed: string | null,
): PageAction | undefined {
  if (pressed === null) {
    return undefined;
  }
  return actions.find((entry) => entry.key === pressed);
}

/** Index of the selected action; with no selection, the first enabled action. */
export function actionIndex(actions: PageAction[], selectedId: ActionId | null): number {
  const index =
    selectedId === null
      ? actions.findIndex((entry) => entry.enabled)
      : actions.findIndex((entry) => entry.id === selectedId);
  return Math.max(index, 0);
}

export function nextActionId(
  actions: PageAction[],
  selectedIndex: number,
  delta: number,
): ActionId | null {
  if (actions.length === 0) {
    return null;
  }
  const current = Math.min(Math.max(selectedIndex, 0), actions.length - 1);
  const next = (current + delta + actions.length) % actions.length;
  return actions[next]?.id ?? null;
}

export interface ActionHintOptions {
  /** Add the ↑/↓ move and enter select hints for a selectable action list. */
  selection?: boolean;
  extra?: ActionHint[];
}

export function actionHints(actions: PageAction[], options: ActionHintOptions = {}): ActionHint[] {
  const hints: ActionHint[] = [];
  if (options.selection) {
    hints.push(["↑/↓", "move"], ["enter", "select"]);
  }
  if (options.extra) {
    hints.push(...options.extra);
  }
  for (const entry of actions) {
    if (entry.key) {
      hints.push([entry.key, entry.hint]);
    }
  }
  return hints;
}
