import type { DirectSshMode, SandboxDetails, TerminalSession } from "@lewdev/core";

export type ActionId =
  | "open"
  | "start"
  | "stop"
  | "restart"
  | "resize"
  | "lifecycle"
  | "ssh"
  | "sessions"
  | "attach-session"
  | "view-session"
  | "kill-session"
  | "confirm-kill-session"
  | "new-shell"
  | "ssh-info"
  | "setup-ssh"
  | "setup-public-ssh"
  | "confirm-setup-private"
  | "confirm-setup-public"
  | "repair-ssh"
  | "open-vscode"
  | "add-ssh-key"
  | "remove-ssh-key"
  | "confirm-remove-ssh-key"
  | "disable-ssh"
  | "confirm-disable-ssh"
  | "reset-ssh"
  | "confirm-reset-ssh"
  | "enable-public-ssh"
  | "confirm-enable-public-ssh"
  | "use-private-ssh"
  | "confirm-include"
  | "ports"
  | "browse-files"
  | "delete"
  | "new"
  | "new-snapshot"
  | "create-snapshot"
  | "confirm-create-snapshot"
  | "delete-snapshot"
  | "confirm-delete-snapshot"
  | "new-sandbox-from-snapshot"
  | "connect"
  | "open-port"
  | "close-port"
  | "custom-domains"
  | "add-custom-domain"
  | "remove-custom-domain"
  | "confirm-remove-custom-domain"
  | "network-usage"
  | "network-limits"
  | "audit-log"
  | "filter-audit"
  | "load-more-audit"
  | "copy-ssh"
  | "trust-hosts"
  | "confirm-trust-hosts"
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
  protocol?: "http" | "tcp" | "tls";
  /** Raw-TCP exposures only. */
  host?: string;
  hostPort?: number;
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

const LOADING_REASON = "The sandbox details are still loading.";
const TRANSITIONAL_REASON = "The sandbox is still starting. Wait for it to finish.";
const DELETED_REASON = "The sandbox has been deleted.";

export interface SandboxActionContext {
  status: SandboxDetails["status"] | null;
  /** False for WASM/isolate sandboxes, which have no shell for SSH or sessions. */
  hasShell?: boolean;
  /** Direct SSH is configured and usable in its current mode. */
  directReady?: boolean;
  /** lewdev already has a direct-SSH config block for this sandbox. */
  sshConfigured?: boolean;
}

interface SandboxReasons {
  terminal?: string;
  setupSsh?: string;
  directSsh?: string;
  ports?: string;
  files?: string;
  snapshot?: string;
  start?: string;
  stop?: string;
  restart?: string;
  manage?: string;
  addKey?: string;
  domains?: string;
  network?: string;
  audit?: string;
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

  const terminalReason =
    blocked ??
    (!running
      ? "The sandbox must be running to open a terminal."
      : context.hasShell === false
        ? "This sandbox has no shell, so it cannot run a terminal session."
        : undefined);

  const shellReason = blocked ?? (!running ? "The sandbox must be running to use SSH." : undefined);
  const noShellReason =
    shellReason ??
    (context.hasShell === false ? "This sandbox has no shell, so it cannot run sshd." : undefined);
  const directReason =
    noShellReason ??
    (context.directReady
      ? undefined
      : context.sshConfigured
        ? 'SSH is not working. Open "SSH settings" and choose "Repair SSH".'
        : 'SSH is not set up yet. Use "Connect with VS Code / SSH" on the sandbox page first.');

  const portsReason = blocked ?? (running ? undefined : "Start the sandbox before managing ports.");
  const filesReason =
    blocked ?? (running ? undefined : "The sandbox must be running to browse its files.");

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
    terminal: terminalReason,
    setupSsh: noShellReason,
    directSsh: directReason,
    addKey: directReason,
    ports: portsReason,
    files: filesReason,
    snapshot: blocked,
    start: startReason,
    stop: stopReason,
    restart: restartReason,
    manage: blocked,
    domains: blocked,
    network: blocked,
    audit: blocked,
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

/** Actions for the Snapshots list page, acting on the highlighted snapshot. */
export function buildSnapshotListActions(): PageAction[] {
  return [
    action("open", "Open snapshot", "select", "enter", "Open the highlighted snapshot.", undefined),
    action(
      "new-snapshot",
      "New snapshot",
      "new",
      "n",
      "Register a snapshot from an image reference or a Dockerfile.",
      undefined,
    ),
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

/** Actions on a snapshot page, in the order the list shows them. */
export function buildSnapshotPageActions(): PageAction[] {
  return [
    action(
      "new-sandbox-from-snapshot",
      "New sandbox from snapshot",
      "new sandbox",
      undefined,
      "Create a sandbox that boots from this snapshot.",
      undefined,
    ),
    action(
      "delete-snapshot",
      "Delete snapshot",
      "delete",
      undefined,
      "Delete the snapshot; this cannot be undone.",
      undefined,
      "error",
    ),
    action("back", "Back", "back", "esc", "Return to the Snapshots tab.", undefined),
  ];
}

/** Actions on the snapshot delete confirmation page. */
export function buildSnapshotDeleteActions(): PageAction[] {
  return [
    action(
      "confirm-delete-snapshot",
      "Delete snapshot",
      "delete",
      undefined,
      "Delete the snapshot; this cannot be undone.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the snapshot.", undefined),
  ];
}

/** Actions on the New snapshot form page. */
export function buildNewSnapshotActions(): PageAction[] {
  return [
    action(
      "submit",
      "Register snapshot",
      "register",
      "enter",
      "Register the snapshot with the entered values.",
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
    action("back", "Cancel", "cancel", "esc", "Return to the Snapshots tab.", undefined),
  ];
}

/** Actions on the Create snapshot form page. */
export function buildCreateSnapshotActions(): PageAction[] {
  return [
    action(
      "submit",
      "Create snapshot",
      "create",
      "enter",
      "Snapshot the sandbox's disk.",
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
    action("back", "Cancel", "cancel", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the snapshot confirmation shown before a running sandbox is paused. */
export function buildCreateSnapshotConfirmActions(): PageAction[] {
  return [
    action(
      "confirm-create-snapshot",
      "Create snapshot",
      "create",
      undefined,
      "Pause the sandbox briefly while its disk is copied, then create the snapshot.",
      undefined,
    ),
    action(
      "back",
      "Cancel",
      "cancel",
      "esc",
      "Return to the form without creating a snapshot.",
      undefined,
    ),
  ];
}

/** Actions on a sandbox page, in the order the grouped list shows them. */
export function buildSandboxPageActions(context: SandboxActionContext): PageAction[] {
  const reasons = sandboxReasons(context);
  const directSetUp = context.directReady === true || context.sshConfigured === true;

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
      "resize",
      "Resize",
      "resize",
      undefined,
      "Change the sandbox's CPU, memory or disk.",
      reasons.manage,
    ),
    action(
      "lifecycle",
      "Lifecycle",
      "lifecycle",
      undefined,
      "Stop, delete, restart or wake the sandbox automatically.",
      reasons.manage,
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
      "Attach to this sandbox's running shell session, or start one.",
      reasons.terminal,
    ),
    action(
      "sessions",
      "Sessions",
      "sessions",
      undefined,
      "List terminal sessions, view their output, or kill one.",
      reasons.terminal,
    ),
    ...(directSetUp
      ? []
      : [
          action(
            "setup-ssh",
            "Connect with VS Code / SSH",
            "connect vs code",
            undefined,
            "Set up private SSH and open the sandbox in VS Code, or copy the SSH command.",
            reasons.setupSsh,
          ),
        ]),
    ...(directSetUp
      ? [
          action(
            "open-vscode",
            "Open in VS Code",
            "vs code",
            undefined,
            "Open /root through VS Code Remote-SSH.",
            reasons.directSsh,
          ),
          action(
            "copy-ssh",
            "Copy SSH command",
            "copy ssh",
            undefined,
            "Copy the ssh command for this sandbox.",
            reasons.directSsh,
          ),
        ]
      : []),
    action(
      "ssh-info",
      "SSH settings",
      "settings",
      undefined,
      "Show connection details and advanced SSH settings.",
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
    action(
      "custom-domains",
      "Custom domains",
      "domains",
      undefined,
      "Bind a custom hostname, see the DNS records to create, and check its certificate.",
      reasons.domains,
    ),
    action(
      "browse-files",
      "Browse files",
      "files",
      undefined,
      "Browse the sandbox's files and upload or download them.",
      reasons.files,
    ),
    action(
      "create-snapshot",
      "Create snapshot",
      "snapshot",
      undefined,
      "Save the sandbox's disk as a reusable snapshot.",
      reasons.snapshot,
    ),
    action(
      "network-usage",
      "Network usage",
      "usage",
      undefined,
      "Show bytes in and out, traffic limits and whether the quota is exceeded.",
      reasons.network,
    ),
    action(
      "audit-log",
      "Audit log",
      "audit",
      undefined,
      "Read outbound connections, egress denials and secret access.",
      reasons.audit,
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
    ...(port.protocol === undefined ? {} : { protocol: port.protocol }),
    ...(port.host === undefined ? {} : { host: port.host }),
    ...(port.hostPort === undefined ? {} : { hostPort: port.hostPort }),
  }));

  return [
    { actions: collect(["start", "stop", "restart", "resize", "lifecycle", "delete"]) },
    { title: "Terminal", actions: collect(["ssh", "sessions"]) },
    {
      title: "SSH",
      actions: collect(["setup-ssh", "open-vscode", "copy-ssh", "ssh-info"]),
    },
    {
      title: "Ports",
      ...(portRows.length > 0 ? { ports: portRows } : { note: "No ports open" }),
      actions: collect(["ports", "custom-domains"]),
    },
    { title: "Files", actions: collect(["browse-files"]) },
    { title: "Snapshots", actions: collect(["create-snapshot"]) },
    { title: "Activity", actions: collect(["network-usage", "audit-log"]) },
    { actions: collect(["back"]) },
  ];
}

/** Actions on the SSH settings page. */
export function buildSshDetailsActions(context: {
  canManageHostKeys: boolean;
  directReady: boolean;
  hasKeys: boolean;
  running?: boolean;
  hasShell?: boolean;
  mode?: DirectSshMode | null;
}): PageAction[] {
  const directReason =
    context.running === false
      ? "The sandbox must be running to use SSH."
      : context.hasShell === false
        ? "This sandbox has no shell, so it cannot run sshd."
        : context.directReady
          ? undefined
          : context.mode === null || context.mode === undefined
            ? 'SSH is not set up yet. Use "Connect with VS Code / SSH" on the sandbox page first.'
            : 'SSH is not working. Choose "Repair SSH" below.';
  const repairReason =
    context.running === false
      ? "The sandbox must be running to repair SSH."
      : context.hasShell === false
        ? "This sandbox has no shell, so it cannot run sshd."
        : undefined;
  const resetReason =
    context.running === false
      ? "The sandbox must be running to reset SSH."
      : context.hasShell === false
        ? "This sandbox has no shell, so it cannot run sshd."
        : undefined;
  const modeReason =
    context.running === false
      ? "The sandbox must be running to change the SSH mode."
      : context.hasShell === false
        ? "This sandbox has no shell, so it cannot run sshd."
        : undefined;
  const notConfigured = context.mode === null;
  return [
    ...(notConfigured && !context.directReady
      ? [
          action(
            "setup-public-ssh",
            "Set up public SSH",
            "public ssh",
            undefined,
            "Expose TCP port 22 to the internet and configure public SSH from scratch.",
            modeReason,
            "error",
          ),
        ]
      : []),
    action(
      "copy-ssh",
      "Copy SSH command",
      "copy ssh",
      undefined,
      "Copy the ssh command for this sandbox.",
      directReason,
    ),
    action(
      "add-ssh-key",
      "Add SSH key",
      "add key",
      undefined,
      "Authorize another public key for root.",
      directReason,
    ),
    action(
      "remove-ssh-key",
      "Remove SSH key",
      "remove key",
      undefined,
      "Remove one key from root's authorized_keys.",
      directReason ?? (context.hasKeys ? undefined : "Root has no SSH keys to remove."),
      "error",
    ),
    action(
      "disable-ssh",
      "Disable SSH",
      "disable ssh",
      undefined,
      "Close TCP port 22, stop sshd, and remove lewdev's SSH config entry.",
      directReason,
      "error",
    ),
    action(
      "repair-ssh",
      "Repair SSH",
      "repair ssh",
      undefined,
      "Re-run setup in the current mode to repair keys, sshd, and the SSH config entry.",
      repairReason,
    ),
    action(
      "reset-ssh",
      "Reset SSH",
      "reset ssh",
      undefined,
      "Remove lewdev's key and local SSH state, then run setup again with a fresh key.",
      resetReason,
      "error",
    ),
    ...(context.mode === "private"
      ? [
          action(
            "enable-public-ssh",
            "Enable public TCP port",
            "public tcp",
            undefined,
            "Expose TCP port 22 to the internet so machines without lewdev can connect.",
            modeReason,
            "error",
          ),
        ]
      : context.mode === "public"
        ? [
            action(
              "use-private-ssh",
              "Use private connection",
              "private",
              undefined,
              "Close the public TCP port and connect through the AerolVM API instead.",
              modeReason,
            ),
          ]
        : []),
    action(
      "trust-hosts",
      "Trust gateway host keys",
      "trust keys",
      undefined,
      "Scan every gateway node and save all of its host keys.",
      context.canManageHostKeys
        ? undefined
        : "The SSH host could not be derived from the configured API URL.",
    ),
    action(
      "forget-host",
      "Forget saved host key",
      "forget host key",
      undefined,
      "Remove the saved gateway keys so the next connection asks to trust them again.",
      context.canManageHostKeys
        ? undefined
        : "The SSH host could not be derived from the configured API URL.",
      "error",
    ),
    action("back", "Back", "back", "esc", "Return to the previous page.", undefined),
  ];
}

/** Groups the SSH settings actions for rendering. */
export function buildSshDetailsGroups(actions: PageAction[]): ActionGroup[] {
  const collect = (ids: ActionId[]): PageAction[] =>
    ids.flatMap((id) => {
      const entry = actions.find((candidate) => candidate.id === id);
      return entry ? [entry] : [];
    });
  return [
    { actions: collect(["copy-ssh"]) },
    {
      title: "Advanced",
      actions: collect([
        "setup-public-ssh",
        "enable-public-ssh",
        "use-private-ssh",
        "repair-ssh",
        "reset-ssh",
        "disable-ssh",
        "add-ssh-key",
        "remove-ssh-key",
        "trust-hosts",
        "forget-host",
      ]),
    },
    { actions: collect(["back"]) },
  ];
}

/** Actions on the guided Set up SSH page. */
export function buildSetupSshActions(context: {
  running: boolean;
  completed: boolean;
  failed: boolean;
  mode?: DirectSshMode;
  /** Started from Connect with VS Code / SSH; no private/public prompt. */
  guided?: boolean;
}): PageAction[] {
  if (context.running) {
    return [];
  }
  const back = action(
    "back",
    context.completed ? "Done" : "Cancel",
    context.completed ? "done" : "cancel",
    "esc",
    context.completed ? "Return to the sandbox page." : "Leave the sandbox unchanged.",
    undefined,
  );
  if (context.guided) {
    return [
      ...(context.completed
        ? []
        : [
            action(
              "confirm-setup-private",
              context.failed ? "Try again" : "Connect with VS Code / SSH",
              "connect",
              "enter",
              "Run private SSH setup again.",
              undefined,
            ),
          ]),
      back,
    ];
  }
  return [
    ...(context.completed
      ? []
      : [
          action(
            "confirm-setup-private",
            "Set up private SSH",
            "private",
            "enter",
            "Recommended: no exposed port, connected through the AerolVM API.",
            undefined,
          ),
          action(
            "confirm-setup-public",
            "Set up public SSH",
            "public",
            undefined,
            "Expose TCP port 22 to the internet for machines without lewdev. Key-only.",
            undefined,
            "error",
          ),
        ]),
    back,
  ];
}

/** Actions on the confirmation page for exposing the public TCP port. */
export function buildEnablePublicSshActions(): PageAction[] {
  return [
    action(
      "confirm-enable-public-ssh",
      "Enable public TCP port",
      "enable public",
      undefined,
      "Expose TCP port 22 to the internet and switch the SSH config block to host/port.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the private connection.", undefined),
  ];
}

/** Actions on the ~/.ssh/config Include confirmation page. */ /** Actions on the ~/.ssh/config Include confirmation page. */
export function buildSshIncludeActions(): PageAction[] {
  return [
    action(
      "confirm-include",
      "Add Include",
      "add include",
      "enter",
      "Add lewdev's ssh_config to ~/.ssh/config.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Leave ~/.ssh/config unchanged.", undefined),
  ];
}

/** Actions on the Add SSH key form page. */
export function buildAddSshKeyActions(): PageAction[] {
  return [
    action(
      "submit",
      "Add key",
      "add key",
      "enter",
      "Add the pasted public key to root's authorized_keys.",
      undefined,
    ),
    action(
      "paste",
      "Paste from clipboard",
      "paste",
      "ctrl+v",
      "Paste a public key into the field.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to SSH settings.", undefined),
  ];
}

/** Actions on the Remove SSH key confirmation page. */
export function buildRemoveSshKeyActions(context: {
  hasKeys: boolean;
  isLewdev: boolean;
}): PageAction[] {
  return [
    action(
      "confirm-remove-ssh-key",
      context.isLewdev ? "Remove lewdev key" : "Remove key",
      "remove",
      undefined,
      "Remove the selected key from root's authorized_keys.",
      context.hasKeys ? undefined : "Root has no SSH keys to remove.",
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the key.", undefined),
  ];
}

/** Actions on the Disable SSH confirmation page. */
export function buildDisableSshActions(): PageAction[] {
  return [
    action(
      "confirm-disable-ssh",
      "Disable SSH",
      "disable",
      undefined,
      "Close port 22, stop sshd, and remove lewdev's SSH config entry.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep SSH enabled.", undefined),
  ];
}

/** Actions on the Reset SSH confirmation page. */
export function buildResetSshActions(): PageAction[] {
  return [
    action(
      "confirm-reset-ssh",
      "Reset SSH",
      "reset",
      undefined,
      "Remove lewdev's old key and local SSH state, then run setup again with a fresh key.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Leave SSH unchanged.", undefined),
  ];
}

/** Actions on the trust-gateway-host-keys confirmation page. */
export function buildTrustHostActions(): PageAction[] {
  return [
    action(
      "confirm-trust-hosts",
      "Trust these keys",
      "trust",
      undefined,
      "Save every scanned gateway key in lewdev's known_hosts.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Leave the saved host keys unchanged.", undefined),
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
      "Expose the port with the selected protocol once both fields are filled in.",
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

/** Actions on the custom domains list; x removes the selected domain. */
export function buildCustomDomainsPageActions(context: {
  hasDomains: boolean;
  hasSelectedDomain: boolean;
  /** Set when the server has custom domains switched off. */
  unavailableReason?: string;
}): PageAction[] {
  return [
    action(
      "add-custom-domain",
      "Add domain",
      "add",
      "a",
      "Bind a hostname and show the DNS records to create.",
      context.unavailableReason,
    ),
    action(
      "remove-custom-domain",
      "Remove domain",
      "remove",
      "x",
      "Remove the selected hostname and its certificate binding.",
      context.hasSelectedDomain
        ? undefined
        : context.hasDomains
          ? "Select a domain first."
          : "There are no custom domains to remove.",
      "error",
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the Add custom domain form; after adding, only Done remains. */
export function buildAddCustomDomainActions(context: { added: boolean }): PageAction[] {
  if (context.added) {
    return [action("back", "Done", "done", "esc", "Return to the custom domains list.", undefined)];
  }
  return [
    action(
      "submit",
      "Add domain",
      "add",
      "enter",
      "Bind the hostname and show the DNS records to create.",
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
    action("back", "Cancel", "cancel", "esc", "Return to the custom domains list.", undefined),
  ];
}

/** Actions on the remove-custom-domain confirmation page. */
export function buildRemoveCustomDomainActions(): PageAction[] {
  return [
    action(
      "confirm-remove-custom-domain",
      "Remove domain",
      "remove",
      undefined,
      "Unbind the hostname and drop its certificate; this cannot be undone.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Keep the custom domain.", undefined),
  ];
}

/** Actions on the network usage page. */
export function buildNetworkUsageActions(context: { hasUsage: boolean }): PageAction[] {
  return [
    action(
      "network-limits",
      "Set limits",
      "set limits",
      "s",
      "Cap inbound and outbound traffic, or remove the caps.",
      context.hasUsage ? undefined : "Network usage has not loaded yet.",
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the network limits form page. */
export function buildNetworkLimitsActions(): PageAction[] {
  return [
    action(
      "submit",
      "Save limits",
      "save",
      "enter",
      "Apply the inbound and outbound caps.",
      undefined,
    ),
    action(
      "paste",
      "Paste from clipboard",
      "paste",
      "ctrl+v",
      "Paste a number into the focused field.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to network usage.", undefined),
  ];
}

/** Actions on the read-only audit log page. */
export function buildAuditLogActions(context: { hasMore: boolean }): PageAction[] {
  return [
    action(
      "filter-audit",
      "Filter by kind",
      "filter",
      "f",
      "Show only one kind of audit event.",
      undefined,
    ),
    action(
      "load-more-audit",
      "Load more",
      "load more",
      "m",
      "Load the next page of audit events.",
      context.hasMore ? undefined : "There are no more events to load.",
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the Sessions page, acting on the selected session. */
export function buildSessionsPageActions(context: {
  sessions: TerminalSession[];
  selected: TerminalSession | undefined;
}): PageAction[] {
  const selected = context.selected;
  const noSessions = context.sessions.length === 0 ? "There are no sessions." : undefined;
  const attachReason =
    noSessions ??
    (selected === undefined
      ? "Select a session first."
      : selected.status !== "running"
        ? "The session has ended. View its output instead."
        : !selected.pty
          ? "This session has no terminal to attach to."
          : undefined);
  const inspectReason =
    noSessions ?? (selected === undefined ? "Select a session first." : undefined);

  return [
    action(
      "attach-session",
      "Attach",
      "attach",
      "enter",
      "Attach to the selected session's terminal.",
      attachReason,
    ),
    action(
      "view-session",
      "View output",
      "output",
      "v",
      "Read the selected session's recent output.",
      inspectReason,
    ),
    action(
      "kill-session",
      "Kill session",
      "kill",
      // Not "k": that moves the cursor up, so it would kill a different session.
      "x",
      "Stop the session and remove its output; this cannot be undone.",
      inspectReason,
      "error",
    ),
    action(
      "new-shell",
      "New shell session",
      "new shell",
      "n",
      "Start another login shell that keeps running when you leave.",
      undefined,
    ),
    action("back", "Back", "back", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the read-only session output page. */
export function buildSessionLogActions(): PageAction[] {
  return [action("back", "Back", "back", "esc", "Return to the sessions list.", undefined)];
}

/** Actions on the kill-session confirmation page. */
export function buildKillSessionActions(): PageAction[] {
  return [
    action(
      "confirm-kill-session",
      "Kill session",
      "kill",
      undefined,
      "Stop the session and remove its output; this cannot be undone.",
      undefined,
      "error",
    ),
    action("back", "Cancel", "cancel", "esc", "Leave the session running.", undefined),
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

/** Actions on the Lifecycle form page. */
export function buildLifecycleActions(): PageAction[] {
  return [
    action(
      "submit",
      "Save lifecycle",
      "save",
      "enter",
      "Save the automatic stop, delete, restart and wake settings.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to the sandbox page.", undefined),
  ];
}

/** Actions on the Resize form page. */
export function buildResizeActions(): PageAction[] {
  return [
    action(
      "submit",
      "Resize",
      "resize",
      "enter",
      "Apply the new CPU, memory and disk sizes.",
      undefined,
    ),
    action("back", "Cancel", "cancel", "esc", "Return to the sandbox page.", undefined),
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
