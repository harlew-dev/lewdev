import { describe, expect, test } from "bun:test";

import {
  actionHints,
  actionIndex,
  actionKey,
  buildAddSshKeyActions,
  buildConnectActions,
  buildDeleteActions,
  buildDisableSshActions,
  buildForgetHostActions,
  buildNewSandboxActions,
  buildOpenPortActions,
  buildPortsPageActions,
  buildRemoveSshKeyActions,
  buildResetSshActions,
  buildSandboxListActions,
  buildSandboxPageActions,
  buildSandboxPageGroups,
  buildCreateSnapshotActions,
  buildCreateSnapshotConfirmActions,
  buildNewSnapshotActions,
  buildSetupSshActions,
  buildSnapshotDeleteActions,
  buildSnapshotListActions,
  buildSnapshotPageActions,
  buildSshDetailsActions,
  buildSshDetailsGroups,
  buildSshIncludeActions,
  buildTrustHostActions,
  findActionForKey,
  nextActionId,
  type PageAction,
} from "../src/actions";

const started = {
  status: "started" as const,
  keyAvailable: true,
  sshCommandAvailable: true,
  hasShell: true,
  directReady: true,
};

function shortcuts(actions: PageAction[]): Record<string, string | undefined> {
  return Object.fromEntries(actions.map((entry) => [entry.id, entry.key]));
}

describe("sandbox page actions", () => {
  test("uses the grouped action order without letter shortcuts", () => {
    const actions = buildSandboxPageActions(started);

    expect(actions.map((entry) => entry.id)).toEqual([
      "start",
      "stop",
      "restart",
      "resize",
      "lifecycle",
      "delete",
      "ssh",
      "open-vscode",
      "copy-ssh",
      "ssh-info",
      "ports",
      "create-snapshot",
      "back",
    ]);
    expect(actions.find((entry) => entry.id === "ssh")?.label).toBe("Open terminal");
    expect(actions.find((entry) => entry.id === "ssh-info")?.label).toBe("SSH settings");
    expect(actions.find((entry) => entry.id === "delete")?.tone).toBe("error");
    expect(shortcuts(actions)).toEqual({
      start: undefined,
      stop: undefined,
      restart: undefined,
      resize: undefined,
      lifecycle: undefined,
      delete: undefined,
      ssh: undefined,
      "open-vscode": undefined,
      "copy-ssh": undefined,
      "ssh-info": undefined,
      ports: undefined,
      "create-snapshot": undefined,
      back: "esc",
    });
    expect(actions.find((entry) => entry.id === "quit")).toBeUndefined();
    expect(actions.filter((entry) => entry.id !== "start").every((entry) => entry.enabled)).toBe(
      true,
    );
  });

  test("offers one guided connect action until direct SSH is set up", () => {
    const actions = buildSandboxPageActions({
      ...started,
      directReady: false,
      sshConfigured: false,
    });
    expect(actions.find((entry) => entry.id === "setup-ssh")?.label).toBe(
      "Connect with VS Code / SSH",
    );
    expect(actions.find((entry) => entry.id === "open-vscode")).toBeUndefined();
    expect(actions.find((entry) => entry.id === "copy-ssh")).toBeUndefined();
    expect(actions.find((entry) => entry.id === "ssh-info")?.label).toBe("SSH settings");
  });

  test("keeps the direct SSH actions once a config block exists", () => {
    const actions = buildSandboxPageActions({
      ...started,
      directReady: false,
      sshConfigured: true,
    });
    expect(actions.find((entry) => entry.id === "setup-ssh")).toBeUndefined();
    expect(
      actions.filter((entry) => entry.id === "open-vscode" || entry.id === "copy-ssh"),
    ).toHaveLength(2);
  });

  test("disables start and enables stop while running", () => {
    const actions = buildSandboxPageActions(started);
    expect(actions.find((entry) => entry.id === "start")?.unavailableReason).toBe(
      "The sandbox is already running.",
    );
    expect(actions.find((entry) => entry.id === "stop")?.enabled).toBe(true);
  });

  test("disables SSH, ports, stop and restart while stopped", () => {
    const actions = buildSandboxPageActions({ ...started, status: "stopped" });

    expect(actions.find((entry) => entry.id === "start")?.enabled).toBe(true);
    expect(actions.find((entry) => entry.id === "stop")?.unavailableReason).toBe(
      "The sandbox is already stopped.",
    );
    expect(actions.find((entry) => entry.id === "ssh")?.unavailableReason).toBe(
      "The sandbox must be running to connect via SSH.",
    );
    expect(actions.find((entry) => entry.id === "ports")?.unavailableReason).toBe(
      "Start the sandbox before managing ports.",
    );
    expect(actions.find((entry) => entry.id === "restart")?.unavailableReason).toBe(
      "The sandbox is not running. Use Start instead.",
    );
    expect(actions.find((entry) => entry.id === "ssh-info")?.enabled).toBe(true);
  });

  test("disables SSH with the no-key reason", () => {
    const actions = buildSandboxPageActions({ ...started, keyAvailable: false });
    const ssh = actions.find((entry) => entry.id === "ssh");

    expect(ssh?.enabled).toBe(false);
    expect(ssh?.unavailableReason).toBe(
      'No private key is stored for this sandbox. Keys are only available for sandboxes lewdev created. Use "Connect with VS Code / SSH" instead.',
    );
  });

  test("disables SSH when the host cannot be derived", () => {
    const actions = buildSandboxPageActions({ ...started, sshCommandAvailable: false });
    expect(actions.find((entry) => entry.id === "ssh")?.unavailableReason).toBe(
      "The SSH host could not be derived from the configured API URL.",
    );
  });

  test("disables the direct SSH actions when a config block is broken", () => {
    const actions = buildSandboxPageActions({
      ...started,
      directReady: false,
      sshConfigured: true,
    });
    for (const id of ["open-vscode", "copy-ssh"] as const) {
      expect(actions.find((entry) => entry.id === id)?.unavailableReason).toBe(
        'SSH is not working. Open "SSH settings" and choose "Repair SSH".',
      );
    }
    expect(actions.find((entry) => entry.id === "setup-ssh")).toBeUndefined();
  });

  test("disables SSH setup on sandboxes without a shell", () => {
    const actions = buildSandboxPageActions({
      ...started,
      directReady: false,
      sshConfigured: false,
      hasShell: false,
    });
    expect(actions.find((entry) => entry.id === "setup-ssh")?.unavailableReason).toBe(
      "This sandbox has no shell, so it cannot run sshd.",
    );
    expect(actions.find((entry) => entry.id === "open-vscode")).toBeUndefined();
    expect(actions.find((entry) => entry.id === "copy-ssh")).toBeUndefined();
  });

  test("disables lifecycle actions while the sandbox is transitioning", () => {
    const actions = buildSandboxPageActions({ ...started, status: "creating" });

    for (const id of [
      "ssh",
      "open-vscode",
      "copy-ssh",
      "ports",
      "create-snapshot",
      "start",
      "stop",
      "restart",
    ] as const) {
      const entry = actions.find((item) => item.id === id);
      expect(entry?.enabled).toBe(false);
      expect(entry?.unavailableReason).toBe(
        "The sandbox is still starting. Wait for it to finish.",
      );
    }

    const unconfigured = buildSandboxPageActions({
      ...started,
      status: "creating",
      directReady: false,
      sshConfigured: false,
    });
    expect(unconfigured.find((entry) => entry.id === "setup-ssh")?.unavailableReason).toBe(
      "The sandbox is still starting. Wait for it to finish.",
    );
  });

  test("disables sandbox actions until the details have loaded", () => {
    const actions = buildSandboxPageActions({
      status: null,
      keyAvailable: false,
      sshCommandAvailable: true,
    });
    expect(actions.find((entry) => entry.id === "ssh")?.unavailableReason).toBe(
      "The sandbox details are still loading.",
    );
    expect(actions.find((entry) => entry.id === "back")?.enabled).toBe(true);
  });
});

describe("sandbox page groups", () => {
  test("groups lifecycle, SSH, ports and back without making rows selectable", () => {
    const actions = buildSandboxPageActions(started);
    const groups = buildSandboxPageGroups(actions, [
      { port: 8080, url: "https://8080.example", visibility: "public" },
      { port: 3000, url: "https://3000.example", visibility: "token" },
      {
        port: 25565,
        url: "tcp://eu.example.test:22042",
        protocol: "tcp",
        host: "eu.example.test",
        hostPort: 22042,
      },
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      undefined,
      "Terminal",
      "SSH",
      "Ports",
      "Snapshots",
      undefined,
    ]);
    expect(groups.map((group) => group.actions.map((entry) => entry.id))).toEqual([
      ["start", "stop", "restart", "resize", "lifecycle", "delete"],
      ["ssh"],
      ["open-vscode", "copy-ssh", "ssh-info"],
      ["ports"],
      ["create-snapshot"],
      ["back"],
    ]);
    expect(groups[3]?.ports).toEqual([
      { id: "port-8080", port: 8080, url: "https://8080.example", visibility: "public" },
      { id: "port-3000", port: 3000, url: "https://3000.example", visibility: "token" },
      {
        id: "port-25565",
        port: 25565,
        url: "tcp://eu.example.test:22042",
        visibility: "public",
        protocol: "tcp",
        host: "eu.example.test",
        hostPort: 22042,
      },
    ]);
    expect(groups.flatMap((group) => group.actions)).toEqual(actions);
  });

  test("shows the guided connect action and settings before setup", () => {
    const actions = buildSandboxPageActions({
      ...started,
      directReady: false,
      sshConfigured: false,
    });
    const groups = buildSandboxPageGroups(actions, []);
    const ssh = groups.find((group) => group.title === "SSH");

    expect(ssh?.actions.map((entry) => entry.id)).toEqual(["setup-ssh", "ssh-info"]);
    expect(ssh?.actions[0]?.label).toBe("Connect with VS Code / SSH");
  });

  test("shows a muted note when no ports are open", () => {
    const groups = buildSandboxPageGroups(buildSandboxPageActions(started), []);
    const ports = groups.find((group) => group.title === "Ports");

    expect(ports?.note).toBe("No ports open");
    expect(ports?.ports).toBeUndefined();
  });
});

describe("sandbox list actions", () => {
  test("keeps only select, new, connect and quit", () => {
    const actions = buildSandboxListActions();

    expect(actions.map((entry) => entry.id)).toEqual(["open", "new", "connect", "quit"]);
    expect(shortcuts(actions)).toEqual({
      open: "enter",
      new: "n",
      connect: "c",
      quit: "q",
    });
    expect(actions.find((entry) => entry.id === "open")?.hint).toBe("select");
    expect(actions.find((entry) => entry.id === "open")?.enabled).toBe(true);
    expect(actions.find((entry) => entry.id === "back")).toBeUndefined();
    expect(findActionForKey(actions, "esc")).toBeUndefined();
    expect(findActionForKey(actions, "s")).toBeUndefined();
  });
});

describe("snapshot actions", () => {
  test("snapshot list mirrors the sandbox list keys", () => {
    const actions = buildSnapshotListActions();

    expect(actions.map((entry) => entry.id)).toEqual(["open", "new-snapshot", "connect", "quit"]);
    expect(shortcuts(actions)).toEqual({
      open: "enter",
      "new-snapshot": "n",
      connect: "c",
      quit: "q",
    });
    expect(actions.find((entry) => entry.id === "new-snapshot")?.label).toBe("New snapshot");
  });

  test("snapshot page offers boot, delete and back", () => {
    const actions = buildSnapshotPageActions();

    expect(actions.map((entry) => entry.id)).toEqual([
      "new-sandbox-from-snapshot",
      "delete-snapshot",
      "back",
    ]);
    expect(actions.find((entry) => entry.id === "delete-snapshot")?.tone).toBe("error");
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
    expect(actions.filter((entry) => entry.id !== "back").every((entry) => entry.enabled)).toBe(
      true,
    );
  });

  test("snapshot delete confirmation and forms cancel with esc", () => {
    const confirmation = buildSnapshotDeleteActions();
    expect(confirmation.map((entry) => entry.id)).toEqual(["confirm-delete-snapshot", "back"]);
    expect(confirmation.find((entry) => entry.id === "confirm-delete-snapshot")?.tone).toBe(
      "error",
    );
    expect(confirmation.find((entry) => entry.id === "back")?.label).toBe("Cancel");

    for (const actions of [buildNewSnapshotActions(), buildCreateSnapshotActions()]) {
      expect(actions.find((entry) => entry.id === "submit")?.key).toBe("enter");
      expect(actions.find((entry) => entry.id === "paste")?.key).toBe("ctrl+v");
      expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
    }
  });

  test("create snapshot confirmation offers create and cancel", () => {
    const actions = buildCreateSnapshotConfirmActions();

    expect(actions.map((entry) => entry.id)).toEqual(["confirm-create-snapshot", "back"]);
    expect(actions.find((entry) => entry.id === "confirm-create-snapshot")?.key).toBeUndefined();
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
    expect(actions.find((entry) => entry.id === "back")?.label).toBe("Cancel");
  });
});

describe("other page actions", () => {
  test("ports page closes the selected port with x", () => {
    const withPort = buildPortsPageActions({ hasPorts: true, hasSelectedPort: true });
    const buttonSelected = buildPortsPageActions({ hasPorts: true, hasSelectedPort: false });
    const withoutPort = buildPortsPageActions({ hasPorts: false, hasSelectedPort: false });

    expect(withPort.map((entry) => entry.id)).toEqual(["open-port", "close-port", "back"]);
    expect(withPort.find((entry) => entry.id === "open-port")?.key).toBe("o");
    expect(withPort.find((entry) => entry.id === "close-port")?.key).toBe("x");
    expect(withPort.find((entry) => entry.id === "back")?.key).toBe("esc");
    expect(withPort.find((entry) => entry.id === "quit")).toBeUndefined();
    expect(buttonSelected.find((entry) => entry.id === "close-port")?.unavailableReason).toBe(
      "Select a port first.",
    );
    expect(withoutPort.find((entry) => entry.id === "close-port")?.unavailableReason).toBe(
      "There are no open ports to close.",
    );
  });

  test("delete page offers delete and cancel without letter shortcuts", () => {
    const actions = buildDeleteActions();
    expect(actions.map((entry) => entry.id)).toEqual(["confirm-delete", "back"]);
    expect(actions.find((entry) => entry.id === "confirm-delete")?.key).toBeUndefined();
    expect(actions.find((entry) => entry.id === "confirm-delete")?.tone).toBe("error");
    expect(actions.find((entry) => entry.id === "back")?.label).toBe("Cancel");
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
  });

  test("connect back is available only once a server is saved", () => {
    expect(
      buildConnectActions({ canGoBack: true }).find((entry) => entry.id === "back")?.enabled,
    ).toBe(true);
    expect(
      buildConnectActions({ canGoBack: false }).find((entry) => entry.id === "back")
        ?.unavailableReason,
    ).toBe("Connect to a server first.");
  });

  test("form pages submit with enter, paste with ctrl+v and cancel with esc", () => {
    for (const actions of [buildNewSandboxActions(), buildOpenPortActions()]) {
      expect(actions.find((entry) => entry.id === "submit")?.key).toBe("enter");
      expect(actions.find((entry) => entry.id === "paste")?.key).toBe("ctrl+v");
      expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
    }
  });

  test("settings lists direct SSH, gateway and back actions without letter shortcuts", () => {
    const actions = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: true,
      hasKeys: true,
    });
    expect(actions.map((entry) => entry.id)).toEqual([
      "copy-ssh",
      "add-ssh-key",
      "remove-ssh-key",
      "disable-ssh",
      "repair-ssh",
      "reset-ssh",
      "trust-hosts",
      "forget-host",
      "back",
    ]);
    expect(actions.find((entry) => entry.id === "copy-ssh")?.key).toBeUndefined();
    expect(actions.find((entry) => entry.id === "trust-hosts")?.key).toBeUndefined();
    expect(actions.find((entry) => entry.id === "forget-host")?.key).toBeUndefined();
    expect(actions.find((entry) => entry.id === "disable-ssh")?.tone).toBe("error");
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
    expect(actions.find((entry) => entry.id === "quit")).toBeUndefined();

    const groups = buildSshDetailsGroups(actions);
    expect(groups.map((group) => group.title)).toEqual([undefined, "Advanced", undefined]);
    expect(groups.map((group) => group.actions.map((entry) => entry.id))).toEqual([
      ["copy-ssh"],
      [
        "repair-ssh",
        "reset-ssh",
        "disable-ssh",
        "add-ssh-key",
        "remove-ssh-key",
        "trust-hosts",
        "forget-host",
      ],
      ["back"],
    ]);
  });

  test("offers public setup from Advanced only before direct SSH is set up", () => {
    const unconfigured = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: false,
      hasKeys: false,
      running: true,
      hasShell: true,
      mode: null,
    });
    expect(unconfigured.find((entry) => entry.id === "setup-public-ssh")?.label).toBe(
      "Set up public SSH",
    );
    expect(
      buildSshDetailsGroups(unconfigured)
        .find((group) => group.title === "Advanced")
        ?.actions.map((entry) => entry.id),
    ).toContain("setup-public-ssh");

    const configured = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: true,
      hasKeys: true,
      running: true,
      hasShell: true,
      mode: "private",
    });
    expect(configured.find((entry) => entry.id === "setup-public-ssh")).toBeUndefined();
  });

  test("Reset SSH stays available while running even when SSH is broken", () => {
    const broken = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: false,
      hasKeys: false,
      running: true,
      hasShell: true,
    });
    expect(broken.find((entry) => entry.id === "reset-ssh")?.enabled).toBe(true);
    expect(broken.find((entry) => entry.id === "reset-ssh")?.tone).toBe("error");
    expect(broken.find((entry) => entry.id === "repair-ssh")?.enabled).toBe(true);

    const stopped = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: false,
      hasKeys: false,
      running: false,
      hasShell: true,
    });
    expect(stopped.find((entry) => entry.id === "reset-ssh")?.unavailableReason).toBe(
      "The sandbox must be running to reset SSH.",
    );
  });

  test("settings switch depends on the current mode", () => {
    const privateMode = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: true,
      hasKeys: true,
      running: true,
      hasShell: true,
      mode: "private",
    });
    expect(privateMode.find((entry) => entry.id === "enable-public-ssh")?.label).toBe(
      "Enable public TCP port",
    );
    expect(privateMode.find((entry) => entry.id === "enable-public-ssh")?.tone).toBe("error");

    const publicMode = buildSshDetailsActions({
      canManageHostKeys: true,
      directReady: true,
      hasKeys: true,
      running: true,
      hasShell: true,
      mode: "public",
    });
    expect(publicMode.find((entry) => entry.id === "use-private-ssh")?.label).toBe(
      "Use private connection",
    );
    expect(publicMode.find((entry) => entry.id === "enable-public-ssh")).toBeUndefined();
  });

  test("disables trusting and forgetting host keys without a gateway host", () => {
    const actions = buildSshDetailsActions({
      canManageHostKeys: false,
      directReady: true,
      hasKeys: true,
    });
    for (const id of ["trust-hosts", "forget-host"] as const) {
      expect(actions.find((entry) => entry.id === id)?.unavailableReason).toBe(
        "The SSH host could not be derived from the configured API URL.",
      );
    }
  });

  test("trust confirmation offers trust and cancel", () => {
    const actions = buildTrustHostActions();
    expect(actions.map((entry) => entry.id)).toEqual(["confirm-trust-hosts", "back"]);
    expect(actions.find((entry) => entry.id === "confirm-trust-hosts")?.label).toBe(
      "Trust these keys",
    );
    expect(actions.find((entry) => entry.id === "confirm-trust-hosts")?.tone).toBe("default");
    expect(actions.find((entry) => entry.id === "back")?.label).toBe("Cancel");
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
  });

  test("forget confirmation offers forget and cancel", () => {
    const actions = buildForgetHostActions();
    expect(actions.map((entry) => entry.id)).toEqual(["confirm-forget", "back"]);
    expect(actions.find((entry) => entry.id === "confirm-forget")?.tone).toBe("error");
    expect(actions.find((entry) => entry.id === "back")?.label).toBe("Cancel");
    expect(actions.find((entry) => entry.id === "back")?.key).toBe("esc");
  });
});

describe("direct SSH pages", () => {
  test("setup page offers private first and public second, and finishes", () => {
    const confirm = buildSetupSshActions({ running: false, completed: false, failed: false });
    expect(confirm.map((entry) => entry.id)).toEqual([
      "confirm-setup-private",
      "confirm-setup-public",
      "back",
    ]);
    expect(confirm.find((entry) => entry.id === "confirm-setup-private")?.label).toBe(
      "Set up private SSH",
    );
    expect(confirm.find((entry) => entry.id === "confirm-setup-public")?.tone).toBe("error");

    expect(buildSetupSshActions({ running: true, completed: false, failed: false })).toEqual([]);
    const done = buildSetupSshActions({ running: false, completed: true, failed: false });
    expect(done.map((entry) => entry.id)).toEqual(["back"]);
    expect(done.find((entry) => entry.id === "back")?.label).toBe("Done");
  });

  test("guided setup retries private SSH without the private/public prompt", () => {
    const retry = buildSetupSshActions({
      running: false,
      completed: false,
      failed: true,
      guided: true,
    });
    expect(retry.map((entry) => entry.id)).toEqual(["confirm-setup-private", "back"]);
    expect(retry.find((entry) => entry.id === "confirm-setup-private")?.label).toBe("Try again");
    expect(retry.find((entry) => entry.id === "confirm-setup-public")).toBeUndefined();

    const initial = buildSetupSshActions({
      running: false,
      completed: false,
      failed: false,
      guided: true,
    });
    expect(initial.map((entry) => entry.id)).toEqual(["confirm-setup-private", "back"]);

    const done = buildSetupSshActions({
      running: false,
      completed: true,
      failed: false,
      guided: true,
    });
    expect(done.map((entry) => entry.id)).toEqual(["back"]);
    expect(done.find((entry) => entry.id === "back")?.label).toBe("Done");
  });

  test("reset confirmation offers reset and cancel", () => {
    const actions = buildResetSshActions();
    expect(actions.map((entry) => entry.id)).toEqual(["confirm-reset-ssh", "back"]);
    expect(actions.find((entry) => entry.id === "confirm-reset-ssh")?.tone).toBe("error");
    expect(actions.find((entry) => entry.id === "back")?.label).toBe("Cancel");
  });

  test("include, add key and disable pages cancel with esc", () => {
    expect(buildSshIncludeActions().map((entry) => entry.id)).toEqual(["confirm-include", "back"]);
    expect(buildAddSshKeyActions().map((entry) => entry.id)).toEqual(["submit", "paste", "back"]);
    expect(buildDisableSshActions().map((entry) => entry.id)).toEqual([
      "confirm-disable-ssh",
      "back",
    ]);
    expect(buildDisableSshActions().find((entry) => entry.id === "confirm-disable-ssh")?.tone).toBe(
      "error",
    );
  });

  test("remove key warns about lewdev's key and requires a key", () => {
    const normal = buildRemoveSshKeyActions({ hasKeys: true, isLewdev: false });
    expect(normal.map((entry) => entry.id)).toEqual(["confirm-remove-ssh-key", "back"]);
    expect(normal.find((entry) => entry.id === "confirm-remove-ssh-key")?.label).toBe("Remove key");

    const own = buildRemoveSshKeyActions({ hasKeys: true, isLewdev: true });
    expect(own.find((entry) => entry.id === "confirm-remove-ssh-key")?.label).toBe(
      "Remove lewdev key",
    );

    const empty = buildRemoveSshKeyActions({ hasKeys: false, isLewdev: false });
    expect(empty.find((entry) => entry.id === "confirm-remove-ssh-key")?.enabled).toBe(false);
  });
});

describe("action keys", () => {
  const key = (name: string, overrides: Partial<Parameters<typeof actionKey>[0]> = {}) =>
    actionKey({
      name,
      ctrl: false,
      meta: false,
      shift: false,
      sequence: name,
      ...overrides,
    });

  test("normalises letters, shift, enter and escape", () => {
    expect(key("s")).toBe("s");
    expect(key("s", { shift: true, sequence: "S" })).toBe("S");
    expect(key("R", { shift: true, sequence: "R" })).toBe("R");
    expect(key("return")).toBe("enter");
    expect(key("escape")).toBe("esc");
    expect(key("q")).toBe("q");
  });

  test("matches ctrl+v and ctrl+] including the raw escape byte", () => {
    expect(key("v", { ctrl: true, sequence: "\x16" })).toBe("ctrl+v");
    expect(key("]", { ctrl: true, sequence: "\x1d" })).toBe("ctrl+]");
    expect(key("", { ctrl: true, sequence: "\x1d" })).toBe("ctrl+]");
    expect(key("", { ctrl: false, sequence: "\x1d" })).toBe("ctrl+]");
  });

  test("ignores arrow, tab and escape-less control keys", () => {
    expect(key("down")).toBeNull();
    expect(key("tab")).toBeNull();
    expect(key("c", { ctrl: true })).toBeNull();
    expect(key("a", { meta: true })).toBeNull();
  });
});

describe("action selection and hints", () => {
  const actions = buildSandboxPageActions(started);

  test("finds an action by its optional key", () => {
    expect(findActionForKey(actions, "esc")?.id).toBe("back");
    expect(findActionForKey(actions, null)).toBeUndefined();
    expect(findActionForKey(actions, "s")).toBeUndefined();
    expect(findActionForKey(actions, "z")).toBeUndefined();
  });

  test("keeps the selected id across a rebuild and wraps", () => {
    expect(actionIndex(actions, "ports")).toBe(10);
    expect(actionIndex(actions, "missing" as never)).toBe(0);
    // With nothing selected, the first enabled action wins: Start is disabled while running.
    expect(actionIndex(actions, null)).toBe(1);
    expect(nextActionId(actions, 0, 1)).toBe("stop");
    expect(nextActionId(actions, 0, -1)).toBe("back");
    expect(nextActionId([], 0, 1)).toBeNull();
  });

  test("derives footer hints from actions that still have keys", () => {
    expect(actionHints(actions, { selection: true })).toEqual([
      ["↑/↓", "move"],
      ["enter", "select"],
      ["esc", "back"],
    ]);

    const deleteActions = buildDeleteActions();
    expect(actionHints(deleteActions, { selection: true })).toEqual([
      ["↑/↓", "move"],
      ["enter", "select"],
      ["esc", "cancel"],
    ]);
    expect(actionHints(deleteActions, { extra: [["tab", "next field"]] })).toEqual([
      ["tab", "next field"],
      ["esc", "cancel"],
    ]);
  });
});
