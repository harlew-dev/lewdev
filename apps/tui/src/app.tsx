import {
  buildSshArgv,
  type CreateSandboxInput,
  deletePrivateKey,
  describeError,
  formatSshCommand,
  getConfigPath,
  getKeyPath,
  LewdevApi,
  type LewdevConfig,
  loadConfig,
  normalizeApiUrl,
  privateKeyExists,
  type SandboxDetails,
  type SandboxInfo,
  saveConfig,
  savePrivateKey,
  sshHostFromApiUrl,
} from "@lewdev/core";
import type { KeyEvent } from "@opentui/core";
import { decodePasteBytes } from "@opentui/core";
import { useKeyboard, usePaste, useRenderer } from "@opentui/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readClipboard, writeClipboard } from "./clipboard";
import {
  BusyLine,
  ConfirmDialog,
  Header,
  type KeyHint,
  KeyHints,
  ToastLine,
  type ToastMessage,
} from "./components";
import {
  buildDetailsMenu,
  type DetailsActionId,
  type DetailsMenuItem,
  detailsSelectionIndex,
  nextDetailsSelection,
} from "./details-menu";
import { safeHost, sandboxLabel } from "./format";
import { type ConnectFormState, ConnectScreen } from "./screens/connect";
import {
  CREATE_DEFAULT,
  CREATE_FIELDS,
  type CreateFormValues,
  CreateScreen,
} from "./screens/create";
import { DetailsScreen } from "./screens/details";
import { ListScreen } from "./screens/list";
import { type PortFormValues, PortsScreen } from "./screens/ports";
import { SshDetailsScreen } from "./screens/ssh-details";
import { colors } from "./theme";

type Screen =
  | { kind: "list" }
  | { kind: "connect" }
  | { kind: "create" }
  | { kind: "details"; id: string }
  | { kind: "ports"; id: string };

type ConnectField = "url" | "token";

const SPINNER_FRAMES = ["|", "/", "-", "\\"] as const;

function shortcut(key: KeyEvent, name: string): "plain" | "shift" | null {
  if (key.ctrl || key.meta) {
    return null;
  }
  const keyName = key.name.length === 1 ? key.name.toLowerCase() : key.name;
  if (keyName !== name) {
    return null;
  }
  const sequence = key.sequence;
  const sequenceIsUpper =
    sequence.length === 1 &&
    sequence !== sequence.toLowerCase() &&
    sequence === sequence.toUpperCase();
  return key.shift || sequenceIsUpper ? "shift" : "plain";
}

function printableChar(key: KeyEvent): string | null {
  if (key.ctrl || key.meta) {
    return null;
  }
  const sequence = key.sequence;
  if ([...sequence].length === 1) {
    const codePoint = sequence.codePointAt(0) ?? 0;
    if (codePoint >= 32 && codePoint !== 127) {
      return sequence;
    }
  }
  if (key.name === "space") {
    return " ";
  }
  return null;
}

function appendText(value: string, text: string): string {
  return `${value}${text}`;
}

function removeLastChar(value: string): string {
  return [...value].slice(0, -1).join("");
}

function parseOptionalNumber(raw: string, label: string, integer: boolean): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return value;
}

export function App() {
  const renderer = useRenderer();

  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [config, setConfig] = useState<LewdevConfig | null>(null);
  const [configPath, setConfigPath] = useState("");
  const [api, setApi] = useState<LewdevApi | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  const [connectForm, setConnectForm] = useState<ConnectFormState>({ url: "", token: "" });
  const [connectField, setConnectField] = useState<ConnectField>("url");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [selected, setSelected] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SandboxInfo | null>(null);
  const hasSandboxes = useRef(false);
  const clipboardBusy = useRef(false);
  const insertPasteRef = useRef<(text: string) => void>(() => {});

  const [createValues, setCreateValues] = useState<CreateFormValues>(CREATE_DEFAULT);
  const [createField, setCreateField] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);

  const [details, setDetails] = useState<SandboxDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [keyAvailable, setKeyAvailable] = useState(false);
  const [portSelected, setPortSelected] = useState(0);
  const [portForm, setPortForm] = useState<PortFormValues | null>(null);
  const [portFormError, setPortFormError] = useState<string | null>(null);
  const [detailsActionId, setDetailsActionId] = useState<DetailsActionId>("ssh");
  const [detailsView, setDetailsView] = useState<"menu" | "ssh">("menu");

  const showToast = useCallback((kind: ToastMessage["kind"], message: string) => {
    setToast({ kind, message });
  }, []);

  const quit = useCallback(() => {
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  const refreshList = useCallback(
    async (showLoading = false): Promise<SandboxInfo[]> => {
      if (!api) {
        return [];
      }
      if (showLoading) {
        setListLoading(true);
      }
      try {
        const items = await api.listSandboxes();
        setSandboxes(items);
        setListError(null);
        return items;
      } catch (error) {
        setListError(describeError(error));
        return [];
      } finally {
        if (showLoading) {
          setListLoading(false);
        }
      }
    },
    [api],
  );

  const loadDetails = useCallback(
    async (id: string): Promise<void> => {
      if (!api) {
        return;
      }
      setDetailsLoading(true);
      try {
        const next = await api.getSandbox(id);
        setDetails(next);
        setDetailsError(null);
      } catch (error) {
        setDetailsError(describeError(error));
      } finally {
        setDetailsLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    hasSandboxes.current = sandboxes.length > 0;
  }, [sandboxes.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadConfig();
        if (cancelled) {
          return;
        }
        setConfigPath(loaded.configPath);
        setConfig(loaded.config);
        if (loaded.config) {
          setApi(LewdevApi.fromConfig(loaded.config));
          setScreen({ kind: "list" });
        } else {
          setScreen({ kind: "connect" });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setConfigPath(getConfigPath());
        setConnectError(describeError(error));
        setScreen({ kind: "connect" });
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!api || screen.kind !== "list") {
      return;
    }
    void refreshList(!hasSandboxes.current);
    const timer = setInterval(() => {
      void refreshList(false);
    }, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [api, screen.kind, refreshList]);

  useEffect(() => {
    setSelected((previous) =>
      sandboxes.length === 0 ? 0 : Math.min(previous, sandboxes.length - 1),
    );
  }, [sandboxes.length]);

  useEffect(() => {
    if (screen.kind !== "details" && screen.kind !== "ports") {
      return;
    }
    setDetailsLoading(true);
    void loadDetails(screen.id);
  }, [screen, loadDetails]);

  useEffect(() => {
    let cancelled = false;
    if (!details) {
      setKeyAvailable(false);
      return;
    }
    privateKeyExists(details.id)
      .then((exists) => {
        if (!cancelled) {
          setKeyAvailable(exists);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKeyAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [details]);

  useEffect(() => {
    const count = details?.exposedPorts.length ?? 0;
    setPortSelected((previous) => (count === 0 ? 0 : Math.min(previous, count - 1)));
  }, [details]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(
      () => {
        setToast(null);
      },
      toast.kind === "error" ? 8000 : 4000,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (!busyMessage) {
      return;
    }
    const timer = setInterval(() => {
      setSpinnerFrame((frame) => (frame + 1) % SPINNER_FRAMES.length);
    }, 120);
    return () => {
      clearInterval(timer);
    };
  }, [busyMessage]);

  const selectedSandbox = sandboxes[selected];

  const sshCommand = useMemo(() => {
    if (!details || !config) {
      return null;
    }
    try {
      return formatSshCommand({
        sandboxId: details.id,
        host: sshHostFromApiUrl(config.apiUrl),
        keyPath: getKeyPath(details.id),
      });
    } catch {
      return null;
    }
  }, [details, config]);

  const gatewayHost = useMemo(() => {
    if (!config) {
      return null;
    }
    try {
      return sshHostFromApiUrl(config.apiUrl);
    } catch {
      return null;
    }
  }, [config]);

  const detailsKeyPath = useMemo(() => {
    if (!details) {
      return null;
    }
    try {
      return getKeyPath(details.id);
    } catch {
      return null;
    }
  }, [details]);

  const detailsMenu = useMemo<DetailsMenuItem[]>(() => {
    if (!details) {
      return [];
    }
    return buildDetailsMenu({
      status: details.status,
      keyAvailable,
      sshCommandAvailable: sshCommand !== null,
    });
  }, [details, keyAvailable, sshCommand]);

  const detailsMenuIndex = detailsSelectionIndex(detailsMenu, detailsActionId);

  function openConnect(): void {
    setConnectForm({ url: config?.apiUrl ?? "", token: config?.apiToken ?? "" });
    setConnectField("url");
    setConnectError(null);
    setScreen({ kind: "connect" });
  }

  function openCreate(): void {
    setCreateValues(CREATE_DEFAULT);
    setCreateField(0);
    setCreateError(null);
    setScreen({ kind: "create" });
  }

  function openDetails(id: string): void {
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    setKeyAvailable(false);
    setDetailsActionId("ssh");
    setDetailsView("menu");
    setScreen({ kind: "details", id });
  }

  function openPorts(id: string): void {
    setPortSelected(0);
    setPortForm(null);
    setPortFormError(null);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    setDetailsView("menu");
    setScreen({ kind: "ports", id });
  }

  function moveDetailsSelection(delta: number): void {
    const next = nextDetailsSelection(detailsMenu, detailsMenuIndex, delta);
    if (next) {
      setDetailsActionId(next);
    }
  }

  function triggerDetailsAction(id: DetailsActionId): void {
    const item = detailsMenu.find((entry) => entry.id === id);
    if (item) {
      runDetailsAction(item);
    }
  }

  function runDetailsAction(item: DetailsMenuItem): void {
    if (!details) {
      return;
    }
    if (!item.enabled) {
      showToast("error", item.unavailableReason ?? "This action is unavailable.");
      return;
    }

    switch (item.id) {
      case "ssh":
        void sshTo(details);
        return;
      case "ssh-details":
        setDetailsView("ssh");
        return;
      case "ports":
        openPorts(details.id);
        return;
      case "toggle":
        void runDetailsLifecycle(details.status === "started" ? "stop" : "start");
        return;
      case "restart":
        void runDetailsLifecycle("restart");
        return;
      case "delete":
        setConfirmDelete(details);
        return;
      case "back":
        setScreen({ kind: "list" });
        return;
    }
  }

  async function runDetailsLifecycle(action: "start" | "stop" | "restart"): Promise<void> {
    if (!api || !details) {
      return;
    }
    const id = details.id;
    const label = sandboxLabel(details);
    const message =
      action === "start"
        ? `Starting ${label}…`
        : action === "stop"
          ? `Stopping ${label}…`
          : `Restarting ${label}…`;
    const success =
      action === "start"
        ? `Started ${label}.`
        : action === "stop"
          ? `Stopped ${label}.`
          : `Restarted ${label}.`;

    setBusyMessage(message);
    try {
      if (action === "start") {
        await api.startSandbox(id);
      } else if (action === "stop") {
        await api.stopSandbox(id);
      } else {
        await api.restartSandbox(id);
      }
      await Promise.all([refreshList(false), loadDetails(id)]);
      showToast("info", success);
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function copySshCommand(): Promise<void> {
    if (!sshCommand) {
      showToast("error", "The SSH command is unavailable.");
      return;
    }
    const copied = await writeClipboard(sshCommand);
    showToast(
      copied ? "info" : "error",
      copied ? "Copied SSH command" : "Couldn't copy the SSH command. Use your terminal's copy.",
    );
  }

  async function submitConnect(): Promise<void> {
    if (connectBusy) {
      return;
    }
    setConnectError(null);
    const token = connectForm.token.trim();
    if (!connectForm.url.trim()) {
      setConnectError("API URL is required.");
      return;
    }
    if (!token) {
      setConnectError("API token is required.");
      return;
    }

    let apiUrl: string;
    try {
      apiUrl = normalizeApiUrl(connectForm.url);
    } catch (error) {
      setConnectError(describeError(error));
      return;
    }

    setConnectBusy(true);
    try {
      const candidate = LewdevApi.fromConfig({ apiUrl, apiToken: token });
      const health = await candidate.health();
      // health may not need auth; an authenticated call proves the token works.
      await candidate.listSandboxes();
      const saved = await saveConfig({ apiUrl, apiToken: token });
      setConfig(saved);
      setApi(LewdevApi.fromConfig(saved));
      setSandboxes([]);
      setSelected(0);
      setListError(null);
      setConnectForm({ url: "", token: "" });
      setScreen({ kind: "list" });
      showToast("info", `Connected to AerolVM ${health.version}.`);
    } catch (error) {
      setConnectError(describeError(error));
    } finally {
      setConnectBusy(false);
    }
  }

  async function submitCreate(): Promise<void> {
    if (!api || busyMessage) {
      return;
    }
    setCreateError(null);

    const image = createValues.image.trim();
    if (!image) {
      setCreateError("Image is required.");
      return;
    }

    const input: CreateSandboxInput = { image };
    try {
      const name = createValues.name.trim();
      if (name) {
        input.name = name;
      }
      const cpu = parseOptionalNumber(createValues.cpu, "CPU", false);
      const memoryMB = parseOptionalNumber(createValues.memoryMB, "Memory MB", true);
      const diskGB = parseOptionalNumber(createValues.diskGB, "Disk GB", true);
      if (cpu !== undefined) {
        input.cpu = cpu;
      }
      if (memoryMB !== undefined) {
        input.memoryMB = memoryMB;
      }
      if (diskGB !== undefined) {
        input.diskGB = diskGB;
      }
    } catch (error) {
      setCreateError(describeError(error));
      return;
    }

    setBusyMessage("Creating sandbox…");
    try {
      const created = await api.createSandbox(input);
      let warning: string | null = null;
      if (created.privateKey) {
        try {
          await savePrivateKey(created.sandbox.id, created.privateKey);
        } catch (error) {
          warning = `its SSH key could not be saved: ${describeError(error)}`;
        }
      } else {
        warning = "the server returned no SSH private key";
      }

      const items = await refreshList(false);
      const index = items.findIndex((sandbox) => sandbox.id === created.sandbox.id);
      if (index >= 0) {
        setSelected(index);
      }
      setCreateValues(CREATE_DEFAULT);
      setCreateField(0);
      setScreen({ kind: "list" });
      showToast(
        warning ? "error" : "info",
        warning
          ? `Created ${sandboxLabel(created.sandbox)}, but ${warning}.`
          : `Created ${sandboxLabel(created.sandbox)}.`,
      );
    } catch (error) {
      setCreateError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function runSandboxAction(
    message: string,
    action: () => Promise<unknown>,
    success: string,
  ): Promise<void> {
    setBusyMessage(message);
    try {
      await action();
      await refreshList(false);
      showToast("info", success);
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  function startSelected(): void {
    const sandbox = selectedSandbox;
    if (!sandbox || !api) {
      return;
    }
    if (sandbox.status === "started") {
      showToast("info", `${sandboxLabel(sandbox)} is already running.`);
      return;
    }
    void runSandboxAction(
      `Starting ${sandboxLabel(sandbox)}…`,
      () => api.startSandbox(sandbox.id),
      `Started ${sandboxLabel(sandbox)}.`,
    );
  }

  function stopSelected(): void {
    const sandbox = selectedSandbox;
    if (!sandbox || !api) {
      return;
    }
    if (sandbox.status === "stopped" || sandbox.status === "passivated") {
      showToast("info", `${sandboxLabel(sandbox)} is already stopped.`);
      return;
    }
    void runSandboxAction(
      `Stopping ${sandboxLabel(sandbox)}…`,
      () => api.stopSandbox(sandbox.id),
      `Stopped ${sandboxLabel(sandbox)}.`,
    );
  }

  function restartSelected(): void {
    const sandbox = selectedSandbox;
    if (!sandbox || !api) {
      return;
    }
    void runSandboxAction(
      `Restarting ${sandboxLabel(sandbox)}…`,
      () => api.restartSandbox(sandbox.id),
      `Restarted ${sandboxLabel(sandbox)}.`,
    );
  }

  async function performDelete(): Promise<void> {
    const sandbox = confirmDelete;
    setConfirmDelete(null);
    if (!sandbox || !api) {
      return;
    }

    setBusyMessage(`Deleting ${sandboxLabel(sandbox)}…`);
    try {
      await api.destroySandbox(sandbox.id);
      let warning: string | null = null;
      try {
        await deletePrivateKey(sandbox.id);
      } catch (error) {
        warning = `its stored SSH key could not be deleted: ${describeError(error)}`;
      }
      setScreen({ kind: "list" });
      setDetailsView("menu");
      await refreshList(false);
      showToast(
        warning ? "error" : "info",
        warning
          ? `Deleted ${sandboxLabel(sandbox)}, but ${warning}.`
          : `Deleted ${sandboxLabel(sandbox)}.`,
      );
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function sshTo(sandbox: SandboxInfo): Promise<void> {
    if (!config || busyMessage) {
      return;
    }

    let argv: string[];
    try {
      const keyPath = getKeyPath(sandbox.id);
      if (!(await privateKeyExists(sandbox.id))) {
        showToast(
          "error",
          "No private key is stored for this sandbox. The key is only available for sandboxes created by lewdev.",
        );
        return;
      }
      argv = buildSshArgv({
        sandboxId: sandbox.id,
        host: sshHostFromApiUrl(config.apiUrl),
        keyPath,
      });
    } catch (error) {
      showToast("error", describeError(error));
      return;
    }

    setBusyMessage(`Connecting to ${sandboxLabel(sandbox)} over SSH…`);
    let suspended = false;
    let sshExit = 0;
    let failure: string | null = null;

    try {
      await renderer.suspend();
      suspended = true;
      const child = Bun.spawn(argv, {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      sshExit = await child.exited;
    } catch (error) {
      failure = describeError(error);
    } finally {
      if (suspended) {
        try {
          await renderer.resume();
        } catch (error) {
          failure = `Could not restore the TUI: ${describeError(error)}`;
        }
      }
      setBusyMessage(null);
    }

    if (failure) {
      showToast("error", failure);
    } else if (sshExit !== 0) {
      showToast("error", `ssh exited with status ${sshExit}.`);
    }
    void refreshList(false);
    if (sandbox.id === details?.id) {
      void loadDetails(sandbox.id);
    }
  }

  async function submitPort(): Promise<void> {
    if (!api || screen.kind !== "ports" || !portForm || busyMessage) {
      return;
    }
    const port = Number(portForm.port.trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setPortFormError("Enter a port number from 1 to 65535.");
      return;
    }

    setPortFormError(null);
    setBusyMessage(`Opening port ${port}…`);
    try {
      const opened = await api.openPort(screen.id, port, portForm.visibility);
      setPortForm(null);
      await loadDetails(screen.id);
      showToast("info", `Port ${port} opened: ${opened.url}`);
    } catch (error) {
      setPortFormError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function closeSelectedPort(): Promise<void> {
    if (!api || screen.kind !== "ports" || !details) {
      return;
    }
    const port = details.exposedPorts[portSelected];
    if (!port) {
      return;
    }

    setBusyMessage(`Closing port ${port.port}…`);
    try {
      await api.closePort(screen.id, port.port);
      await loadDetails(screen.id);
      showToast("info", `Port ${port.port} closed.`);
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  function insertPastedText(raw: string): void {
    const text = raw.replace(/[\r\n\t]+/g, " ");
    if (!text) {
      return;
    }

    if (screen.kind === "connect") {
      setConnectForm((previous) => ({
        ...previous,
        [connectField]: appendText(previous[connectField], text),
      }));
      return;
    }
    if (screen.kind === "create") {
      const field = CREATE_FIELDS[createField];
      if (field) {
        setCreateValues((previous) => ({
          ...previous,
          [field.key]: appendText(previous[field.key], text),
        }));
      }
      return;
    }
    if (screen.kind === "ports" && portForm?.field === "port") {
      const digits = text.replace(/\D/g, "");
      if (digits) {
        setPortForm((previous) =>
          previous ? { ...previous, port: appendText(previous.port, digits) } : previous,
        );
      }
    }
  }

  insertPasteRef.current = insertPastedText;

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      quit();
      return;
    }
    if (booting || busyMessage || connectBusy) {
      return;
    }

    if (key.ctrl && key.name.toLowerCase() === "v") {
      const textFieldActive =
        screen.kind === "connect" ||
        (screen.kind === "create" && createField < CREATE_FIELDS.length) ||
        (screen.kind === "ports" && portForm?.field === "port");
      if (!textFieldActive || clipboardBusy.current) {
        return;
      }

      key.preventDefault();
      clipboardBusy.current = true;
      void readClipboard()
        .then((text) => {
          if (text === null) {
            showToast(
              "error",
              "Couldn't read the clipboard. Use your terminal's paste (usually Ctrl+Shift+V).",
            );
            return;
          }
          insertPasteRef.current(text);
        })
        .catch(() => {
          showToast(
            "error",
            "Couldn't read the clipboard. Use your terminal's paste (usually Ctrl+Shift+V).",
          );
        })
        .finally(() => {
          clipboardBusy.current = false;
        });
      return;
    }

    if (confirmDelete) {
      if (shortcut(key, "y") === "plain" || key.name === "return") {
        void performDelete();
        return;
      }
      if (shortcut(key, "n") === "plain" || key.name === "escape") {
        setConfirmDelete(null);
      }
      return;
    }

    if (screen.kind === "connect") {
      if (key.name === "tab") {
        setConnectField((previous) => (previous === "url" ? "token" : "url"));
        return;
      }
      if (key.name === "down") {
        setConnectField("token");
        return;
      }
      if (key.name === "up") {
        setConnectField("url");
        return;
      }
      if (key.name === "return") {
        if (connectField === "url") {
          setConnectField("token");
        } else {
          void submitConnect();
        }
        return;
      }
      if (key.name === "escape" && config) {
        setScreen({ kind: "list" });
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        setConnectForm((previous) => ({
          ...previous,
          [connectField]: removeLastChar(previous[connectField]),
        }));
        return;
      }
      const char = printableChar(key);
      if (char) {
        setConnectForm((previous) => ({
          ...previous,
          [connectField]: appendText(previous[connectField], char),
        }));
      }
      return;
    }

    if (screen.kind === "create") {
      if (key.name === "escape") {
        setScreen({ kind: "list" });
        setCreateError(null);
        return;
      }
      const field = CREATE_FIELDS[createField];
      const previousField =
        key.name === "up" || key.name === "backtab" || (key.name === "tab" && key.shift);
      if (previousField) {
        setCreateField((index) => (index - 1 + CREATE_FIELDS.length) % CREATE_FIELDS.length);
        return;
      }
      if (key.name === "tab" || key.name === "down") {
        setCreateField((index) => (index + 1) % CREATE_FIELDS.length);
        return;
      }
      if (key.name === "return") {
        void submitCreate();
        return;
      }
      if ((key.name === "backspace" || key.name === "delete") && field) {
        setCreateValues((previous) => ({
          ...previous,
          [field.key]: removeLastChar(previous[field.key]),
        }));
        return;
      }
      const char = printableChar(key);
      if (char && field) {
        setCreateValues((previous) => ({
          ...previous,
          [field.key]: appendText(previous[field.key], char),
        }));
      }
      return;
    }

    if (screen.kind === "details") {
      if (detailsView === "ssh") {
        if (key.name === "escape") {
          setDetailsView("menu");
          return;
        }
        if (shortcut(key, "y") === "plain") {
          void copySshCommand();
        }
        return;
      }

      if (key.name === "escape") {
        setScreen({ kind: "list" });
        return;
      }
      if (key.name === "down" || shortcut(key, "j") === "plain") {
        moveDetailsSelection(1);
        return;
      }
      if (key.name === "up" || shortcut(key, "k") === "plain") {
        moveDetailsSelection(-1);
        return;
      }
      if (key.name === "return") {
        const item = detailsMenu[detailsMenuIndex];
        if (item) {
          runDetailsAction(item);
        }
        return;
      }
      if (shortcut(key, "s") === "plain") {
        if (details?.status === "started") {
          showToast("info", "The sandbox is already running.");
          return;
        }
        triggerDetailsAction("toggle");
        return;
      }
      if (shortcut(key, "s") === "shift") {
        triggerDetailsAction("ssh");
        return;
      }
      if (shortcut(key, "x") === "plain") {
        if (details && details.status !== "started") {
          showToast(
            "info",
            details.status === "stopped" || details.status === "passivated"
              ? "The sandbox is already stopped."
              : "The sandbox is not running.",
          );
          return;
        }
        triggerDetailsAction("toggle");
        return;
      }
      if (shortcut(key, "p") === "plain") {
        triggerDetailsAction("ports");
        return;
      }
      if (shortcut(key, "r") === "shift") {
        triggerDetailsAction("restart");
        return;
      }
      if (shortcut(key, "d") === "plain") {
        triggerDetailsAction("delete");
        return;
      }
      if (shortcut(key, "v") === "plain") {
        triggerDetailsAction("ssh-details");
      }
      return;
    }

    if (screen.kind === "ports") {
      if (portForm) {
        if (key.name === "escape") {
          setPortForm(null);
          setPortFormError(null);
          return;
        }
        if (key.name === "tab" || key.name === "down" || key.name === "up") {
          setPortForm((previous) =>
            previous
              ? { ...previous, field: previous.field === "port" ? "visibility" : "port" }
              : previous,
          );
          return;
        }
        if (
          portForm.field === "visibility" &&
          (key.name === "left" || key.name === "right" || key.name === "space")
        ) {
          setPortForm((previous) =>
            previous
              ? {
                  ...previous,
                  visibility: previous.visibility === "public" ? "token" : "public",
                }
              : previous,
          );
          return;
        }
        if (key.name === "return") {
          if (portForm.field === "port") {
            setPortForm((previous) => (previous ? { ...previous, field: "visibility" } : previous));
          } else {
            void submitPort();
          }
          return;
        }
        if (key.name === "backspace" || key.name === "delete") {
          setPortForm((previous) =>
            previous ? { ...previous, port: removeLastChar(previous.port) } : previous,
          );
          return;
        }
        const char = printableChar(key);
        if (char && /^\d$/.test(char)) {
          setPortForm((previous) =>
            previous ? { ...previous, port: appendText(previous.port, char) } : previous,
          );
        }
        return;
      }

      if (key.name === "escape") {
        setScreen({ kind: "details", id: screen.id });
        return;
      }
      if (shortcut(key, "q")) {
        quit();
        return;
      }
      if (key.name === "down" || shortcut(key, "j") === "plain") {
        setPortSelected((previous) =>
          details ? Math.min(previous + 1, Math.max(0, details.exposedPorts.length - 1)) : previous,
        );
        return;
      }
      if (key.name === "up" || shortcut(key, "k") === "plain") {
        setPortSelected((previous) => Math.max(0, previous - 1));
        return;
      }
      if (shortcut(key, "o") === "plain") {
        setPortForm({ field: "port", port: "", visibility: "public" });
        setPortFormError(null);
        return;
      }
      if (shortcut(key, "x") === "plain") {
        void closeSelectedPort();
        return;
      }
      if (shortcut(key, "c") === "plain") {
        openConnect();
      }
      return;
    }

    if (shortcut(key, "q")) {
      quit();
      return;
    }
    if (key.name === "down" || shortcut(key, "j") === "plain") {
      setSelected((previous) => Math.min(previous + 1, Math.max(0, sandboxes.length - 1)));
      return;
    }
    if (key.name === "up" || shortcut(key, "k") === "plain") {
      setSelected((previous) => Math.max(0, previous - 1));
      return;
    }
    if (shortcut(key, "n") === "plain") {
      openCreate();
      return;
    }
    if (shortcut(key, "s") === "plain") {
      startSelected();
      return;
    }
    if (shortcut(key, "s") === "shift") {
      if (selectedSandbox) {
        void sshTo(selectedSandbox);
      }
      return;
    }
    if (shortcut(key, "x") === "plain") {
      stopSelected();
      return;
    }
    if (shortcut(key, "r") === "shift") {
      restartSelected();
      return;
    }
    if (shortcut(key, "d") === "plain") {
      if (selectedSandbox) {
        setConfirmDelete(selectedSandbox);
      }
      return;
    }
    if (key.name === "return") {
      if (selectedSandbox) {
        openDetails(selectedSandbox.id);
      }
      return;
    }
    if (shortcut(key, "p") === "plain") {
      if (selectedSandbox) {
        openPorts(selectedSandbox.id);
      }
      return;
    }
    if (shortcut(key, "c") === "plain") {
      openConnect();
    }
  });

  usePaste((event) => {
    if (booting || busyMessage || connectBusy) {
      return;
    }
    insertPastedText(decodePasteBytes(event.bytes));
  });

  const hints = useMemo<KeyHint[]>(() => {
    if (booting) {
      return [];
    }
    if (confirmDelete) {
      return [
        ["y", "delete"],
        ["n / esc", "cancel"],
      ];
    }
    if (screen.kind === "connect") {
      const items: KeyHint[] = [
        ["tab", "next field"],
        ["enter", "verify & save"],
        ["ctrl+v", "paste"],
        ["ctrl+c", "quit"],
      ];
      if (config) {
        items.splice(2, 0, ["esc", "back"]);
      }
      return items;
    }
    if (screen.kind === "create") {
      return [
        ["tab", "next field"],
        ["enter", "create"],
        ["esc", "back"],
      ];
    }
    if (screen.kind === "details") {
      if (detailsView === "ssh") {
        return [
          ["esc", "back"],
          ["y", "copy ssh"],
        ];
      }
      return [
        ["↑/↓", "move"],
        ["enter", "run"],
        ["s/x", "start / stop"],
        ["R", "restart"],
        ["S", "ssh"],
        ["v", "ssh info"],
        ["p", "ports"],
        ["d", "delete"],
        ["esc", "back"],
      ];
    }
    if (screen.kind === "ports") {
      if (portForm) {
        return [
          ["tab", "next field"],
          ["←/→", "visibility"],
          ["enter", "open port"],
          ["esc", "cancel"],
        ];
      }
      return [
        ["↑/↓", "move"],
        ["o", "open port"],
        ["x", "close port"],
        ["esc", "back"],
        ["q", "quit"],
      ];
    }
    return [
      ["↑/↓", "move"],
      ["n", "new"],
      ["s", "start"],
      ["x", "stop"],
      ["R", "restart"],
      ["d", "delete"],
      ["enter", "details"],
      ["S", "ssh"],
      ["p", "ports"],
      ["c", "connect"],
      ["q", "quit"],
    ];
  }, [booting, screen, config, confirmDelete, portForm, detailsView]);

  if (booting) {
    return (
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        backgroundColor={colors.background}
        padding={1}
      >
        <Header />
        <text fg={colors.muted}>Loading configuration…</text>
      </box>
    );
  }

  let content: ReactNode;
  if (confirmDelete) {
    content = (
      <ConfirmDialog title="Delete sandbox">
        <text fg={colors.text}>
          Delete <span fg={colors.accent}>{sandboxLabel(confirmDelete)}</span>?
        </text>
        <text fg={colors.muted}>{confirmDelete.id}</text>
        <text fg={colors.warning} wrapMode="word">
          This also removes the private key lewdev stored for it. The action cannot be undone.
        </text>
      </ConfirmDialog>
    );
  } else if (screen.kind === "connect") {
    content = (
      <ConnectScreen
        form={connectForm}
        activeField={connectField}
        busy={connectBusy}
        error={connectError}
        configPath={configPath}
      />
    );
  } else if (screen.kind === "create") {
    content = <CreateScreen values={createValues} activeIndex={createField} error={createError} />;
  } else if (screen.kind === "details") {
    content =
      detailsView === "ssh" && details ? (
        <SshDetailsScreen
          details={details}
          gatewayHost={gatewayHost}
          keyPath={detailsKeyPath}
          keyAvailable={keyAvailable}
          sshCommand={sshCommand}
        />
      ) : (
        <DetailsScreen
          details={details}
          loading={detailsLoading}
          error={detailsError}
          menu={detailsMenu}
          selectedIndex={detailsMenuIndex}
        />
      );
  } else if (screen.kind === "ports") {
    content = (
      <PortsScreen
        details={details}
        selected={portSelected}
        loading={detailsLoading}
        error={detailsError}
        form={portForm}
        formError={portFormError}
      />
    );
  } else {
    content = (
      <ListScreen
        sandboxes={sandboxes}
        selected={selected}
        loading={listLoading}
        error={listError}
      />
    );
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.background}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
    >
      <Header right={config ? safeHost(config.apiUrl) : undefined} />
      <ToastLine toast={toast} />
      {content}
      <BusyLine message={busyMessage} frame={SPINNER_FRAMES[spinnerFrame] ?? SPINNER_FRAMES[0]} />
      <KeyHints hints={hints} />
    </box>
  );
}
