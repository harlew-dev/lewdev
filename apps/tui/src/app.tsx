import {
  type AccountInfo,
  backgroundUpdateCheck,
  buildSshArgv,
  type CreateSandboxInput,
  deletePrivateKey,
  describeError,
  ensureKnownHostsFile,
  forgetHostKey,
  formatSshCommand,
  getConfigPath,
  getKeyPath,
  getKnownHostsPath,
  isStandaloneBuild,
  knownHostsEntry,
  LewdevApi,
  type LewdevConfig,
  loadConfig,
  normalizeApiUrl,
  privateKeyExists,
  type RegisterSnapshotInput,
  type SandboxDetails,
  type SandboxInfo,
  saveConfig,
  savePrivateKey,
  type SnapshotInfo,
  SSH_PORT,
  sshHostFromApiUrl,
  summarizeUsage,
  type TeamQuotaInfo,
  type UpdateNotice,
  type UsageSummary,
} from "@lewdev/core";
import type { KeyEvent } from "@opentui/core";
import { decodePasteBytes } from "@opentui/core";
import { useKeyboard, usePaste, useRenderer } from "@opentui/react";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionHints,
  actionIndex,
  actionKey,
  type ActionHint,
  type ActionId,
  buildConnectActions,
  buildCreateSnapshotActions,
  buildDeleteActions,
  buildForgetHostActions,
  buildNewSandboxActions,
  buildNewSnapshotActions,
  buildOpenPortActions,
  buildPortsPageActions,
  buildSandboxListActions,
  buildSandboxPageActions,
  buildSandboxPageGroups,
  buildSnapshotDeleteActions,
  buildSnapshotListActions,
  buildSnapshotPageActions,
  buildSshDetailsActions,
  findActionForKey,
  nextActionId,
  type PageAction,
} from "./actions";
import { readClipboard, writeClipboard } from "./clipboard";
import {
  BusyLine,
  Header,
  HomeTabs,
  KeyHints,
  ToastLine,
  type ToastMessage,
  UsageBar,
} from "./components";
import { safeHost, sandboxLabel } from "./format";
import {
  backFromTerminal,
  breadcrumbTrail,
  currentPage,
  pageSandbox,
  type Page,
  popPage,
  pushPage,
  pushSandboxScoped as pushScopedPage,
  ROOT_PAGE,
  type SandboxPageTarget,
  SNAPSHOTS_PAGE,
} from "./navigation";
import { type ConnectField, type ConnectFormState, ConnectScreen } from "./screens/connect";
import {
  buildSnapshotMenuOptions,
  CREATE_DEFAULT,
  type CreateFocus,
  type CreateFormValues,
  createSizeInput,
  type DockerfileMode,
  IMAGE_MENU_OPTIONS,
  imageOptionIndex,
  menuOptionAt,
  moveSize,
  nextCreateFocus,
  nextMenuIndex,
  resolveDockerfilePath,
  selectImageOption,
  selectSnapshotOption,
  snapshotOptionIndex,
  toggleDockerfileMode,
} from "./create-form";
import { CreateScreen } from "./screens/create";
import { CreateSnapshotScreen, type CreateSnapshotFocus } from "./screens/create-snapshot";
import { DeleteSandboxScreen } from "./screens/delete-sandbox";
import { DeleteSnapshotScreen } from "./screens/delete-snapshot";
import { DetailsScreen } from "./screens/details";
import { ForgetHostScreen } from "./screens/forget-host";
import { ListScreen } from "./screens/list";
import { NewSnapshotScreen } from "./screens/new-snapshot";
import { OpenPortScreen, type PortFormValues } from "./screens/open-port";
import { PORT_VISIBILITY_OPTIONS } from "./port-options";
import { PortsScreen } from "./screens/ports";
import { SnapshotDetailsScreen } from "./screens/snapshot-details";
import { SnapshotsScreen } from "./screens/snapshots";
import { SshDetailsScreen } from "./screens/ssh-details";
import {
  type SshExitResult,
  type SshSessionHandle,
  SshTerminalScreen,
} from "./screens/ssh-terminal";
import {
  createValuesFromSnapshot,
  NEW_SNAPSHOT_DEFAULT,
  type NewSnapshotFocus,
  type NewSnapshotFormValues,
  newSnapshotSizeInput,
  nextNewSnapshotFocus,
  toggleSnapshotSource,
} from "./snapshot-form";
import { colors } from "./theme";
import { VERSION } from "./version";

const SPINNER_FRAMES = ["|", "/", "-", "\\"] as const;

const CONNECT_FIELDS: [ConnectField, ...ConnectField[]] = ["url", "token", "submit"];
const PORT_FIELDS: [PortFormValues["field"], ...PortFormValues["field"][]] = [
  "port",
  "visibility",
  "submit",
];
const CREATE_SNAPSHOT_FIELDS: [CreateSnapshotFocus, ...CreateSnapshotFocus[]] = [
  "name",
  "allow-pause",
  "submit",
];

function nextField<T>(fields: [T, ...T[]], current: T, delta: number): T {
  const index = fields.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + fields.length) % fields.length;
  return fields[next] ?? fields[0];
}

const NO_KEY_REASON =
  "No private key is stored for this sandbox. The key is only available for sandboxes created by lewdev.";
const CLIPBOARD_ERROR =
  "Couldn't read the clipboard. Use your terminal's paste (usually Ctrl+Shift+V).";

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

function targetForSandbox(sandbox: SandboxInfo): SandboxPageTarget {
  return { id: sandbox.id, label: sandboxLabel(sandbox) };
}

async function readDockerfileContents(values: {
  dockerfileMode: DockerfileMode;
  dockerfileContents: string;
  dockerfilePath: string;
}): Promise<string> {
  if (values.dockerfileMode === "paste") {
    if (!values.dockerfileContents.trim()) {
      throw new Error("Paste or type a Dockerfile.");
    }
    return values.dockerfileContents;
  }

  const path = values.dockerfilePath.trim();
  if (!path) {
    throw new Error("Dockerfile path is required.");
  }
  const initial = resolveDockerfilePath(path);
  let resolved = initial;
  try {
    const info = await stat(initial);
    if (info.isDirectory()) {
      resolved = join(initial, "Dockerfile");
    }
  } catch (error) {
    throw new Error(`Could not read ${initial}: ${describeError(error)}`);
  }

  let contents: string;
  try {
    contents = await readFile(resolved, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${resolved}: ${describeError(error)}`);
  }
  if (!contents.trim()) {
    throw new Error(`The Dockerfile at ${resolved} is empty.`);
  }
  return contents;
}

export function App() {
  const renderer = useRenderer();

  const [booting, setBooting] = useState(true);
  const [stack, setStack] = useState<Page[]>([ROOT_PAGE]);
  const [config, setConfig] = useState<LewdevConfig | null>(null);
  const [configPath, setConfigPath] = useState("");
  const [api, setApi] = useState<LewdevApi | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [teamQuota, setTeamQuota] = useState<TeamQuotaInfo | null>(null);
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null);

  const [connectForm, setConnectForm] = useState<ConnectFormState>({ url: "", token: "" });
  const [connectField, setConnectField] = useState<ConnectField>("url");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [selected, setSelected] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const hasSandboxes = useRef(false);
  const clipboardBusy = useRef(false);

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [snapshotSelected, setSnapshotSelected] = useState(0);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const hasSnapshots = useRef(false);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);

  const [snapshotDetails, setSnapshotDetails] = useState<SnapshotInfo | null>(null);
  const [snapshotDetailsLoading, setSnapshotDetailsLoading] = useState(false);
  const [snapshotDetailsError, setSnapshotDetailsError] = useState<string | null>(null);

  const [createSnapshotName, setCreateSnapshotName] = useState("");
  const [createSnapshotAllowPause, setCreateSnapshotAllowPause] = useState(true);
  const [createSnapshotFocus, setCreateSnapshotFocus] = useState<CreateSnapshotFocus>("name");
  const [createSnapshotError, setCreateSnapshotError] = useState<string | null>(null);

  const [newSnapshotValues, setNewSnapshotValues] =
    useState<NewSnapshotFormValues>(NEW_SNAPSHOT_DEFAULT);
  const [newSnapshotFocus, setNewSnapshotFocus] = useState<NewSnapshotFocus>("name");
  const [newSnapshotError, setNewSnapshotError] = useState<string | null>(null);

  const [createValues, setCreateValues] = useState<CreateFormValues>(CREATE_DEFAULT);
  const [createFocus, setCreateFocus] = useState<CreateFocus>("image");
  const [createError, setCreateError] = useState<string | null>(null);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [imageMenuIndex, setImageMenuIndex] = useState(0);
  const [snapshotMenuOpen, setSnapshotMenuOpen] = useState(false);
  const [snapshotMenuIndex, setSnapshotMenuIndex] = useState(0);

  const [details, setDetails] = useState<SandboxDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [keyAvailable, setKeyAvailable] = useState(false);
  const [portSelected, setPortSelected] = useState(0);
  const [portForm, setPortForm] = useState<PortFormValues | null>(null);
  const [portFormError, setPortFormError] = useState<string | null>(null);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilityMenuIndex, setVisibilityMenuIndex] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null);

  const sshSession = useRef<SshSessionHandle | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const page = currentPage(stack);
  const sandboxTarget = pageSandbox(page);
  const sandboxId = sandboxTarget?.id ?? null;
  const usesDetails =
    page.kind === "sandbox" ||
    page.kind === "ssh-details" ||
    page.kind === "ports" ||
    page.kind === "open-port";
  const pageDetails = details && details.id === sandboxId ? details : null;
  const selectedSandbox = sandboxes[selected];
  const selectedSnapshot = snapshots[snapshotSelected];
  const snapshotPageName = page.kind === "snapshot" ? page.name : null;
  const snapshotMenuOptions = useMemo(
    () => buildSnapshotMenuOptions(snapshots, snapshotsLoaded),
    [snapshots, snapshotsLoaded],
  );
  const previousSnapshotMenuOptions = useRef(snapshotMenuOptions);

  // Snapshots can finish loading while the Snapshot menu is open; keep the
  // cursor on the same option instead of the same row index.
  useEffect(() => {
    const previous = previousSnapshotMenuOptions.current;
    previousSnapshotMenuOptions.current = snapshotMenuOptions;
    if (previous === snapshotMenuOptions) {
      return;
    }
    setSnapshotMenuIndex((index) => {
      const option = menuOptionAt(previous, index);
      const moved = option
        ? snapshotMenuOptions.findIndex((candidate) => candidate.id === option.id)
        : -1;
      return moved >= 0 ? moved : Math.min(index, Math.max(0, snapshotMenuOptions.length - 1));
    });
  }, [snapshotMenuOptions]);

  const showToast = useCallback((kind: ToastMessage["kind"], message: string) => {
    setToast({ kind, message });
  }, []);

  useEffect(() => {
    if (!isStandaloneBuild()) {
      return;
    }
    let cancelled = false;
    void backgroundUpdateCheck(VERSION)
      .then((notice) => {
        if (cancelled || !notice) {
          return;
        }
        setUpdateNotice(notice);
        showToast("info", `lewdev ${notice.latestVersion} is available. Run \`lewdev update\`.`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showToast]);

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

  const refreshSnapshots = useCallback(
    async (showLoading = false): Promise<SnapshotInfo[]> => {
      if (!api) {
        return [];
      }
      if (showLoading) {
        setSnapshotsLoading(true);
      }
      try {
        const items = await api.listSnapshots();
        setSnapshots(items);
        setSnapshotsLoaded(true);
        setSnapshotsError(null);
        return items;
      } catch (error) {
        setSnapshotsError(describeError(error));
        return [];
      } finally {
        if (showLoading) {
          setSnapshotsLoading(false);
        }
      }
    },
    [api],
  );

  const loadSnapshotDetails = useCallback(
    async (name: string): Promise<void> => {
      if (!api) {
        return;
      }
      setSnapshotDetailsLoading(true);
      try {
        const next = await api.getSnapshot(name);
        setSnapshotDetails(next);
        setSnapshotDetailsError(null);
      } catch (error) {
        setSnapshotDetailsError(describeError(error));
      } finally {
        setSnapshotDetailsLoading(false);
      }
    },
    [api],
  );

  const quit = useCallback(() => {
    sshSession.current?.kill();
    sshSession.current = null;
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  const push = useCallback((next: Page) => {
    setSelectedActionId(null);
    setTerminalStatus(null);
    setStack((previous) => pushPage(previous, next));
  }, []);

  const pop = useCallback(() => {
    setSelectedActionId(null);
    setStack((previous) => popPage(previous));
  }, []);

  useEffect(() => {
    hasSandboxes.current = sandboxes.length > 0;
  }, [sandboxes.length]);

  useEffect(() => {
    hasSnapshots.current = snapshots.length > 0;
  }, [snapshots.length]);

  useEffect(() => {
    if (!api) {
      return;
    }
    void refreshSnapshots(false);
  }, [api, refreshSnapshots]);

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
          setStack([ROOT_PAGE]);
        } else {
          setStack(pushPage([ROOT_PAGE], { kind: "connect" }));
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setConfigPath(getConfigPath());
        setConnectError(describeError(error));
        setStack(pushPage([ROOT_PAGE], { kind: "connect" }));
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
    if (!api) {
      setAccount(null);
      setTeamQuota(null);
      return;
    }
    let cancelled = false;
    setAccount(null);
    setTeamQuota(null);
    void api
      .whoami()
      .then((info) => {
        if (!cancelled) {
          setAccount(info);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccount(null);
          setTeamQuota(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!api || page.kind !== "sandboxes") {
      return;
    }
    void refreshList(!hasSandboxes.current);
    const timer = setInterval(() => {
      void refreshList(false);
    }, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [api, page.kind, refreshList]);

  useEffect(() => {
    if (!api || page.kind !== "snapshots") {
      return;
    }
    void refreshSnapshots(!hasSnapshots.current);
    const timer = setInterval(() => {
      void refreshSnapshots(false);
    }, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [api, page.kind, refreshSnapshots]);

  useEffect(() => {
    if (!api || page.kind !== "new-sandbox") {
      return;
    }
    void refreshSnapshots(false);
  }, [api, page.kind, refreshSnapshots]);

  useEffect(() => {
    setSelected((previous) => (sandboxes.length === 0 ? 0 : Math.min(previous, sandboxes.length)));
  }, [sandboxes.length]);

  useEffect(() => {
    setSnapshotSelected((previous) =>
      snapshots.length === 0 ? 0 : Math.min(previous, snapshots.length),
    );
  }, [snapshots.length]);

  useEffect(() => {
    if (snapshotPageName === null) {
      return;
    }
    setSnapshotDetailsLoading(true);
    void loadSnapshotDetails(snapshotPageName);
  }, [snapshotPageName, loadSnapshotDetails]);

  const team = account?.team && account.team !== "*" ? account.team : null;

  useEffect(() => {
    if (!team) {
      setTeamQuota(null);
      return;
    }
    if (!api || (page.kind !== "sandboxes" && page.kind !== "snapshots")) {
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const quota = await api.getTeamQuota(team);
        if (!cancelled) {
          setTeamQuota(quota);
        }
      } catch {
        if (!cancelled) {
          setTeamQuota(null);
        }
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, team, page.kind]);

  const usage = useMemo<UsageSummary>(
    () =>
      summarizeUsage({
        sandboxes,
        snapshotCount: snapshotsLoaded ? snapshots.length : null,
        team: account?.team,
        quota: teamQuota,
      }),
    [sandboxes, snapshots.length, snapshotsLoaded, account, teamQuota],
  );

  useEffect(() => {
    if (!usesDetails || !sandboxId) {
      return;
    }
    setDetails(null);
    setDetailsError(null);
    setKeyAvailable(false);
    setDetailsLoading(true);
    void loadDetails(sandboxId);
  }, [usesDetails, sandboxId, loadDetails]);

  useEffect(() => {
    let cancelled = false;
    if (!pageDetails) {
      setKeyAvailable(false);
      return;
    }
    privateKeyExists(pageDetails.id)
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
  }, [pageDetails]);

  useEffect(() => {
    const count = pageDetails?.exposedPorts.length ?? 0;
    setPortSelected((previous) => Math.min(previous, count));
  }, [pageDetails]);

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

  const sshCommand = useMemo(() => {
    if (!pageDetails || !config) {
      return null;
    }
    try {
      return formatSshCommand({
        sandboxId: pageDetails.id,
        host: sshHostFromApiUrl(config.apiUrl),
        keyPath: getKeyPath(pageDetails.id),
        knownHostsPath: getKnownHostsPath(),
      });
    } catch {
      return null;
    }
  }, [pageDetails, config]);

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
    if (!pageDetails) {
      return null;
    }
    try {
      return getKeyPath(pageDetails.id);
    } catch {
      return null;
    }
  }, [pageDetails]);

  const knownHostsPath = useMemo(() => {
    try {
      return getKnownHostsPath();
    } catch {
      return null;
    }
  }, []);

  const forgetEntry = useMemo(() => {
    if (!gatewayHost) {
      return null;
    }
    try {
      return knownHostsEntry(gatewayHost);
    } catch {
      return null;
    }
  }, [gatewayHost]);

  const sshArgv = useMemo(() => {
    if (page.kind !== "ssh-terminal" || !config) {
      return null;
    }
    try {
      return buildSshArgv({
        sandboxId: page.id,
        host: sshHostFromApiUrl(config.apiUrl),
        keyPath: getKeyPath(page.id),
        knownHostsPath: getKnownHostsPath(),
      });
    } catch {
      return null;
    }
  }, [page, config]);

  const actions = useMemo<PageAction[]>(() => {
    const ctx = {
      status: pageDetails?.status ?? null,
      keyAvailable: pageDetails !== null && keyAvailable,
      sshCommandAvailable: gatewayHost !== null,
    };
    switch (page.kind) {
      case "sandboxes":
        return buildSandboxListActions();
      case "snapshots":
        return buildSnapshotListActions();
      case "sandbox":
        return buildSandboxPageActions(ctx);
      case "snapshot":
        return buildSnapshotPageActions();
      case "delete-snapshot":
        return buildSnapshotDeleteActions();
      case "new-snapshot":
        return buildNewSnapshotActions();
      case "create-snapshot":
        return buildCreateSnapshotActions();
      case "ssh-details":
        return buildSshDetailsActions({ canForgetHost: gatewayHost !== null });
      case "forget-host":
        return buildForgetHostActions();
      case "ports": {
        const count = pageDetails?.exposedPorts.length ?? 0;
        return buildPortsPageActions({
          hasPorts: count > 0,
          hasSelectedPort: portSelected < count,
        });
      }
      case "open-port":
        return buildOpenPortActions();
      case "delete-sandbox":
        return buildDeleteActions();
      case "connect":
        return buildConnectActions({ canGoBack: config !== null });
      case "new-sandbox":
        return buildNewSandboxActions();
      case "ssh-terminal":
        return [];
    }
  }, [page, pageDetails, keyAvailable, gatewayHost, config, portSelected]);

  const selectedActionIndex = actionIndex(actions, selectedActionId);
  const sandboxGroups = useMemo(
    () => buildSandboxPageGroups(actions, pageDetails?.exposedPorts ?? []),
    [actions, pageDetails],
  );

  function actionTarget(): SandboxPageTarget | null {
    if (page.kind === "sandboxes") {
      return selectedSandbox ? targetForSandbox(selectedSandbox) : null;
    }
    return pageSandbox(page);
  }

  /**
   * Opens a sandbox-scoped page. From the list we put the sandbox page
   * underneath so breadcrumbs name the sandbox and esc lands on it.
   */
  function pushSandboxScoped(next: Page): void {
    setSelectedActionId(null);
    setTerminalStatus(null);
    setStack((previous) => pushScopedPage(previous, next));
  }

  function runAction(id: ActionId): void {
    switch (id) {
      case "open": {
        if (page.kind === "snapshots") {
          if (selectedSnapshot) {
            setSnapshotDetails(selectedSnapshot);
            setSnapshotDetailsError(null);
            push({ kind: "snapshot", name: selectedSnapshot.name });
          } else {
            openNewSnapshot();
          }
          return;
        }
        if (selected >= sandboxes.length) {
          openCreate();
          return;
        }
        const target = actionTarget();
        if (target) {
          push({ kind: "sandbox", ...target });
        }
        return;
      }
      case "start":
        runLifecycle("start");
        return;
      case "stop":
        runLifecycle("stop");
        return;
      case "restart":
        runLifecycle("restart");
        return;
      case "ssh":
        void connectSsh();
        return;
      case "ssh-info": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "ssh-details", ...target });
        }
        return;
      }
      case "ports": {
        const target = actionTarget();
        if (target) {
          setPortSelected(0);
          pushSandboxScoped({ kind: "ports", ...target });
        }
        return;
      }
      case "delete": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "delete-sandbox", ...target });
          setSelectedActionId("back");
        }
        return;
      }
      case "forget-host": {
        const target = actionTarget();
        if (target) {
          push({ kind: "forget-host", ...target });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-forget":
        void performForgetHost();
        return;
      case "new":
        openCreate();
        return;
      case "new-snapshot":
        openNewSnapshot();
        return;
      case "create-snapshot": {
        const target = actionTarget();
        if (target) {
          setCreateSnapshotName("");
          setCreateSnapshotAllowPause(true);
          setCreateSnapshotFocus("name");
          setCreateSnapshotError(null);
          pushSandboxScoped({ kind: "create-snapshot", ...target });
        }
        return;
      }
      case "new-sandbox-from-snapshot": {
        if (snapshotDetails) {
          openCreateFromSnapshot(snapshotDetails);
        }
        return;
      }
      case "delete-snapshot": {
        if (page.kind === "snapshot") {
          push({ kind: "delete-snapshot", name: page.name });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-delete-snapshot":
        void performDeleteSnapshot();
        return;
      case "connect":
        openConnect();
        return;
      case "open-port": {
        const target = pageSandbox(page);
        if (target) {
          setPortForm({ field: "port", port: "", visibility: "public" });
          setPortFormError(null);
          setVisibilityMenuOpen(false);
          setVisibilityMenuIndex(0);
          pushSandboxScoped({ kind: "open-port", ...target });
        }
        return;
      }
      case "close-port":
        void closeSelectedPort();
        return;
      case "copy-ssh":
        void copySshCommand();
        return;
      case "confirm-delete":
        void performDelete();
        return;
      case "submit":
        submitCurrentForm();
        return;
      case "paste":
        void pasteFromClipboard();
        return;
      case "back":
        pop();
        return;
      case "quit":
        quit();
        return;
    }
  }

  function runKeyAction(key: KeyEvent): boolean {
    const action = findActionForKey(actions, actionKey(key));
    if (!action) {
      return false;
    }
    key.preventDefault();
    if (!action.enabled) {
      showToast("info", action.unavailableReason ?? "This action is unavailable.");
      return true;
    }
    runAction(action.id);
    return true;
  }

  function runLifecycle(action: "start" | "stop" | "restart"): void {
    const target = actionTarget();
    if (!api || !target) {
      return;
    }
    const label = target.label;
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
    void (async () => {
      try {
        if (action === "start") {
          await api.startSandbox(target.id);
        } else if (action === "stop") {
          await api.stopSandbox(target.id);
        } else {
          await api.restartSandbox(target.id);
        }
        await refreshList(false);
        if (sandboxId === target.id) {
          await loadDetails(target.id);
        }
        showToast("success", success);
      } catch (error) {
        showToast("error", describeError(error));
      } finally {
        setBusyMessage(null);
      }
    })();
  }

  async function connectSsh(): Promise<void> {
    const target = actionTarget();
    if (!config || !target) {
      return;
    }
    try {
      if (!(await privateKeyExists(target.id))) {
        showToast("error", NO_KEY_REASON);
        return;
      }
      await ensureKnownHostsFile();
      buildSshArgv({
        sandboxId: target.id,
        host: sshHostFromApiUrl(config.apiUrl),
        keyPath: getKeyPath(target.id),
        knownHostsPath: getKnownHostsPath(),
      });
      pushSandboxScoped({ kind: "ssh-terminal", ...target });
    } catch (error) {
      showToast("error", describeError(error));
    }
  }

  function closeSshTerminal(): void {
    const target = pageSandbox(page);
    sshSession.current?.kill();
    sshSession.current = null;
    setTerminalStatus(null);
    if (!target) {
      return;
    }
    setStack((previous) => backFromTerminal(previous, target));
    void refreshList(false);
    void loadDetails(target.id);
  }

  const handleSshExit = useCallback(
    (result: SshExitResult) => {
      const top = currentPage(stackRef.current);
      if (top.kind !== "ssh-terminal") {
        return;
      }
      if (result.error) {
        const detail = result.error.replace(/\.\s*$/, "");
        setTerminalStatus(`Session ended: ${detail}. Press esc or ctrl+] to go back.`);
        return;
      }
      if (result.status !== null && result.status !== 0) {
        setTerminalStatus(
          `Session ended: ssh exited with status ${result.status}. Press esc or ctrl+] to go back.`,
        );
        return;
      }
      const target: SandboxPageTarget = { id: top.id, label: top.label };
      setTerminalStatus(null);
      setStack((previous) => backFromTerminal(previous, target));
      void refreshList(false);
      void loadDetails(target.id);
    },
    [refreshList, loadDetails],
  );

  const handleSessionChange = useCallback((session: SshSessionHandle | null) => {
    sshSession.current = session;
  }, []);

  async function copySshCommand(): Promise<void> {
    if (!sshCommand) {
      showToast("error", "The SSH command is unavailable.");
      return;
    }
    const copied = await writeClipboard(sshCommand);
    showToast(
      copied ? "success" : "error",
      copied ? "Copied SSH command" : "Couldn't copy the SSH command. Use your terminal's copy.",
    );
  }

  function openConnect(): void {
    setConnectForm({ url: config?.apiUrl ?? "", token: config?.apiToken ?? "" });
    setConnectField("url");
    setConnectError(null);
    push({ kind: "connect" });
  }

  function openCreate(): void {
    setCreateValues(CREATE_DEFAULT);
    setCreateFocus("image");
    setCreateError(null);
    setImageMenuOpen(false);
    setImageMenuIndex(0);
    setSnapshotMenuOpen(false);
    setSnapshotMenuIndex(0);
    push({ kind: "new-sandbox" });
  }

  function openCreateFromSnapshot(snapshot: SnapshotInfo): void {
    setCreateValues(createValuesFromSnapshot(snapshot));
    setCreateFocus("image-snapshot");
    setCreateError(null);
    setImageMenuOpen(false);
    setImageMenuIndex(0);
    setSnapshotMenuOpen(false);
    setSnapshotMenuIndex(0);
    push({ kind: "new-sandbox" });
  }

  function openNewSnapshot(): void {
    setNewSnapshotValues(NEW_SNAPSHOT_DEFAULT);
    setNewSnapshotFocus("name");
    setNewSnapshotError(null);
    push({ kind: "new-snapshot" });
  }

  function openImageMenu(): void {
    setImageMenuIndex(imageOptionIndex(createValues));
    setSnapshotMenuOpen(false);
    setImageMenuOpen(true);
  }

  function chooseImageOption(index: number): void {
    const option = menuOptionAt(IMAGE_MENU_OPTIONS, index);
    if (!option || option.disabled) {
      return;
    }
    setCreateValues((previous) => selectImageOption(previous, option));
    setImageMenuOpen(false);
    if (option.kind === "snapshot") {
      setCreateFocus("image-snapshot");
    }
  }

  function openSnapshotMenu(): void {
    setSnapshotMenuIndex(snapshotOptionIndex(createValues.snapshotName, snapshotMenuOptions));
    setImageMenuOpen(false);
    setSnapshotMenuOpen(true);
  }

  function chooseSnapshotOption(index: number): void {
    const option = menuOptionAt(snapshotMenuOptions, index);
    if (!option || option.disabled) {
      return;
    }
    setCreateValues((previous) => selectSnapshotOption(previous, option));
    setSnapshotMenuOpen(false);
  }

  function openVisibilityMenu(): void {
    const index = PORT_VISIBILITY_OPTIONS.findIndex(
      (option) => option.value === portForm?.visibility,
    );
    setVisibilityMenuIndex(Math.max(index, 0));
    setVisibilityMenuOpen(true);
  }

  function chooseVisibility(index: number): void {
    const option = PORT_VISIBILITY_OPTIONS[index];
    if (!option) {
      return;
    }
    setPortForm((previous) => (previous ? { ...previous, visibility: option.value } : previous));
    setVisibilityMenuOpen(false);
  }

  function submitCurrentForm(): void {
    switch (page.kind) {
      case "connect":
        void submitConnect();
        return;
      case "new-sandbox":
        void submitCreate();
        return;
      case "new-snapshot":
        void submitNewSnapshot();
        return;
      case "create-snapshot":
        void submitCreateSnapshot();
        return;
      case "open-port":
        void submitPort();
        return;
      default:
        return;
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    if (clipboardBusy.current) {
      return;
    }
    clipboardBusy.current = true;
    try {
      const text = await readClipboard();
      if (text === null) {
        showToast("error", CLIPBOARD_ERROR);
        return;
      }
      insertPastedText(text);
    } catch {
      showToast("error", CLIPBOARD_ERROR);
    } finally {
      clipboardBusy.current = false;
    }
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
      setSelectedActionId(null);
      setStack([ROOT_PAGE]);
      showToast("success", `Connected to AerolVM ${health.version}.`);
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

    const input: CreateSandboxInput = {};
    try {
      const name = createValues.name.trim();
      if (name) {
        input.name = name;
      }

      const size = createSizeInput(createValues);
      if (size.cpu !== undefined) {
        input.cpu = size.cpu;
      }
      if (size.memoryMB !== undefined) {
        input.memoryMB = size.memoryMB;
      }
      if (size.diskGB !== undefined) {
        input.diskGB = size.diskGB;
      }

      switch (createValues.imageSource) {
        case "dockerfile":
          input.dockerfile = await readDockerfileContents(createValues);
          break;
        case "custom": {
          const image = createValues.customImage.trim();
          if (!image) {
            throw new Error("Image is required.");
          }
          input.image = image;
          break;
        }
        case "snapshot": {
          const snapshotName = createValues.snapshotName.trim();
          if (!snapshotName) {
            throw new Error("Choose a snapshot.");
          }
          input.image = snapshotName;
          break;
        }
        case "preset":
          input.image = createValues.image;
          break;
      }
    } catch (error) {
      setCreateError(describeError(error));
      return;
    }

    setBusyMessage(
      input.dockerfile === undefined ? "Creating sandbox…" : "Building image and creating sandbox…",
    );
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
      setCreateFocus("image");
      setImageMenuOpen(false);
      setImageMenuIndex(0);
      setSnapshotMenuOpen(false);
      setSnapshotMenuIndex(0);
      setSelectedActionId(null);
      setStack([ROOT_PAGE]);
      showToast(
        warning ? "warning" : "success",
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

  async function submitCreateSnapshot(): Promise<void> {
    if (!api || page.kind !== "create-snapshot" || busyMessage) {
      return;
    }
    const target = pageSandbox(page);
    if (!target) {
      return;
    }
    setCreateSnapshotError(null);
    setBusyMessage("Creating snapshot…");
    try {
      const created = await api.createSnapshot(target.id, createSnapshotName, {
        allowPause: createSnapshotAllowPause,
      });
      setCreateSnapshotName("");
      setCreateSnapshotAllowPause(true);
      setCreateSnapshotFocus("name");
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("success", `Snapshot ${created.name} created`);
      void refreshSnapshots(false);
    } catch (error) {
      setCreateSnapshotError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function submitNewSnapshot(): Promise<void> {
    if (!api || page.kind !== "new-snapshot" || busyMessage) {
      return;
    }
    setNewSnapshotError(null);

    const input: RegisterSnapshotInput = { name: newSnapshotValues.name };
    try {
      input.name = newSnapshotValues.name.trim();
      if (!input.name) {
        throw new Error("Snapshot name is required.");
      }
      if (newSnapshotValues.source === "dockerfile") {
        input.dockerfile = await readDockerfileContents(newSnapshotValues);
      } else {
        const image = newSnapshotValues.image.trim();
        if (!image) {
          throw new Error("Image reference is required.");
        }
        input.image = image;
      }

      const size = newSnapshotSizeInput(newSnapshotValues);
      if (size.cpu !== undefined) {
        input.cpu = size.cpu;
      }
      if (size.memoryMB !== undefined) {
        input.memoryMB = size.memoryMB;
      }
      if (size.diskGB !== undefined) {
        input.diskGB = size.diskGB;
      }
    } catch (error) {
      setNewSnapshotError(describeError(error));
      return;
    }

    setBusyMessage(
      input.dockerfile === undefined
        ? "Registering snapshot…"
        : "Building image and registering snapshot…",
    );
    try {
      const created = await api.registerSnapshot(input);
      const items = await refreshSnapshots(false);
      const index = items.findIndex((snapshot) => snapshot.name === created.name);
      if (index >= 0) {
        setSnapshotSelected(index);
      }
      setNewSnapshotValues(NEW_SNAPSHOT_DEFAULT);
      setNewSnapshotFocus("name");
      setSelectedActionId(null);
      setStack([SNAPSHOTS_PAGE]);
      showToast("success", `Snapshot ${created.name} created`);
    } catch (error) {
      setNewSnapshotError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performDeleteSnapshot(): Promise<void> {
    if (page.kind !== "delete-snapshot" || !api) {
      return;
    }
    const name = page.name;

    setBusyMessage(`Deleting snapshot ${name}…`);
    try {
      await api.deleteSnapshot(name);
      setSnapshotDetails(null);
      setSelectedActionId(null);
      setStack([SNAPSHOTS_PAGE]);
      await refreshSnapshots(false);
      showToast("success", `Deleted snapshot ${name}.`);
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performDelete(): Promise<void> {
    const target = page.kind === "delete-sandbox" ? pageSandbox(page) : null;
    if (!target || !api) {
      return;
    }

    setBusyMessage(`Deleting ${target.label}…`);
    try {
      await api.destroySandbox(target.id);
      let warning: string | null = null;
      try {
        await deletePrivateKey(target.id);
      } catch (error) {
        warning = `its stored SSH key could not be deleted: ${describeError(error)}`;
      }
      setDetails(null);
      setSelectedActionId(null);
      setStack([ROOT_PAGE]);
      await refreshList(false);
      showToast(
        warning ? "warning" : "success",
        warning ? `Deleted ${target.label}, but ${warning}.` : `Deleted ${target.label}.`,
      );
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performForgetHost(): Promise<void> {
    const target = page.kind === "forget-host" ? pageSandbox(page) : null;
    const host = gatewayHost;
    if (!target || !host) {
      return;
    }

    let entry: string;
    try {
      entry = knownHostsEntry(host);
    } catch {
      entry = `${host}:${SSH_PORT}`;
    }

    let removed = false;
    let failure: string | null = null;
    setBusyMessage(`Forgetting the saved host key for ${entry}…`);
    try {
      removed = await forgetHostKey(host);
    } catch (error) {
      failure = describeError(error);
    } finally {
      setBusyMessage(null);
    }

    setSelectedActionId(null);
    setStack((previous) => popPage(previous));
    if (failure) {
      showToast("error", failure);
    } else if (removed) {
      showToast("success", `Forgot the saved host key for ${entry}.`);
    } else {
      showToast("info", `No saved host key for ${entry}.`);
    }
  }

  async function submitPort(): Promise<void> {
    if (!api || page.kind !== "open-port" || busyMessage) {
      return;
    }
    const form = portForm;
    if (!form) {
      return;
    }
    const port = Number(form.port.trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setPortFormError("Enter a port number from 1 to 65535.");
      return;
    }

    setPortFormError(null);
    setBusyMessage(`Opening port ${port}…`);
    try {
      const opened = await api.openPort(page.id, port, form.visibility);
      setPortForm(null);
      await loadDetails(page.id);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("success", `Port ${port} opened: ${opened.url}`);
    } catch (error) {
      setPortFormError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function closeSelectedPort(): Promise<void> {
    if (!api || page.kind !== "ports" || !pageDetails) {
      return;
    }
    const port = pageDetails.exposedPorts[portSelected];
    if (!port) {
      return;
    }

    setBusyMessage(`Closing port ${port.port}…`);
    try {
      await api.closePort(pageDetails.id, port.port);
      await loadDetails(pageDetails.id);
      showToast("success", `Port ${port.port} closed.`);
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  function moveAction(delta: number): void {
    const next = nextActionId(actions, selectedActionIndex, delta);
    if (next) {
      setSelectedActionId(next);
    }
  }

  function insertPastedText(raw: string): void {
    if (
      page.kind === "new-sandbox" &&
      createFocus === "image-dockerfile" &&
      (createValues.dockerfileMode === "paste" || /[\r\n]/.test(raw))
    ) {
      const pasted = raw.replace(/\r\n/g, "\n");
      setCreateValues((previous) => ({
        ...previous,
        dockerfileMode: "paste",
        dockerfileContents:
          previous.dockerfileMode === "paste"
            ? appendText(previous.dockerfileContents, pasted)
            : pasted,
      }));
      return;
    }
    if (
      page.kind === "new-snapshot" &&
      newSnapshotFocus === "dockerfile" &&
      (newSnapshotValues.dockerfileMode === "paste" || /[\r\n]/.test(raw))
    ) {
      const pasted = raw.replace(/\r\n/g, "\n");
      setNewSnapshotValues((previous) => ({
        ...previous,
        dockerfileMode: "paste",
        dockerfileContents:
          previous.dockerfileMode === "paste"
            ? appendText(previous.dockerfileContents, pasted)
            : pasted,
      }));
      return;
    }

    const text = raw.replace(/[\r\n\t]+/g, " ");
    if (!text) {
      return;
    }

    if (page.kind === "connect") {
      if (connectField === "submit") {
        return;
      }
      setConnectForm((previous) => ({
        ...previous,
        [connectField]: appendText(previous[connectField], text),
      }));
      return;
    }
    if (page.kind === "new-sandbox") {
      switch (createFocus) {
        case "image":
          return;
        case "image-ref":
          setCreateValues((previous) => ({
            ...previous,
            customImage: appendText(previous.customImage, text),
          }));
          return;
        case "image-dockerfile-mode":
          return;
        case "image-dockerfile":
          setCreateValues((previous) => ({
            ...previous,
            dockerfilePath: appendText(previous.dockerfilePath, text),
          }));
          return;
        case "size":
          return;
        case "size-cpu":
        case "size-memory": {
          const key = createFocus === "size-cpu" ? "customCpu" : "customMemoryGB";
          const merged = `${createValues[key]}${text}`.replace(/[^\d.]/g, "");
          const [whole = "", ...rest] = merged.split(".");
          setCreateValues((previous) => ({
            ...previous,
            [key]: rest.length > 0 ? `${whole}.${rest.join("")}` : whole,
          }));
          return;
        }
        case "size-disk": {
          const digits = text.replace(/\D/g, "");
          if (digits) {
            setCreateValues((previous) => ({
              ...previous,
              customDiskGB: appendText(previous.customDiskGB, digits),
            }));
          }
          return;
        }
        case "name":
          setCreateValues((previous) => ({
            ...previous,
            name: appendText(previous.name, text),
          }));
          return;
        case "submit":
          return;
      }
    }
    if (page.kind === "create-snapshot") {
      if (createSnapshotFocus === "name") {
        setCreateSnapshotName((previous) => appendText(previous, text));
      }
      return;
    }
    if (page.kind === "new-snapshot") {
      switch (newSnapshotFocus) {
        case "name":
          setNewSnapshotValues((previous) => ({
            ...previous,
            name: appendText(previous.name, text),
          }));
          return;
        case "source":
        case "dockerfile-mode":
        case "submit":
          return;
        case "image-ref":
          setNewSnapshotValues((previous) => ({
            ...previous,
            image: appendText(previous.image, text),
          }));
          return;
        case "dockerfile":
          setNewSnapshotValues((previous) => ({
            ...previous,
            dockerfilePath: appendText(previous.dockerfilePath, text),
          }));
          return;
        case "cpu":
        case "memory": {
          const key = newSnapshotFocus === "cpu" ? "cpu" : "memoryGB";
          const merged = `${newSnapshotValues[key]}${text}`.replace(/[^\d.]/g, "");
          const [whole = "", ...rest] = merged.split(".");
          setNewSnapshotValues((previous) => ({
            ...previous,
            [key]: rest.length > 0 ? `${whole}.${rest.join("")}` : whole,
          }));
          return;
        }
        case "disk": {
          const digits = text.replace(/\D/g, "");
          if (digits) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              diskGB: appendText(previous.diskGB, digits),
            }));
          }
          return;
        }
      }
    }
    if (page.kind === "open-port" && portForm?.field === "port") {
      const digits = text.replace(/\D/g, "");
      if (digits) {
        setPortForm((previous) =>
          previous ? { ...previous, port: appendText(previous.port, digits) } : previous,
        );
      }
    }
  }

  useKeyboard((key) => {
    if (page.kind === "ssh-terminal") {
      const pressed = actionKey(key);
      const ended = terminalStatus !== null;
      if (pressed === "ctrl+]" || (ended && pressed === "esc")) {
        key.preventDefault();
        closeSshTerminal();
        return;
      }
      if (ended) {
        // The session is over; keep its last output on screen and swallow keys.
        key.preventDefault();
        return;
      }
      // Every other key belongs to the remote shell via the focused emulator.
      return;
    }
    if (key.ctrl && key.name === "c") {
      quit();
      return;
    }
    if (booting || busyMessage || connectBusy) {
      return;
    }

    if (page.kind === "sandboxes" || page.kind === "snapshots") {
      const pressed = actionKey(key);
      if (key.name === "tab" || key.name === "backtab") {
        setSelectedActionId(null);
        setStack([page.kind === "sandboxes" ? SNAPSHOTS_PAGE : ROOT_PAGE]);
        return;
      }
      if (pressed === "1") {
        setStack([ROOT_PAGE]);
        return;
      }
      if (pressed === "2") {
        setStack([SNAPSHOTS_PAGE]);
        return;
      }
      if (key.name === "down" || pressed === "j") {
        if (page.kind === "sandboxes") {
          setSelected((previous) => Math.min(previous + 1, sandboxes.length));
        } else {
          setSnapshotSelected((previous) => Math.min(previous + 1, snapshots.length));
        }
        return;
      }
      if (key.name === "up" || pressed === "k") {
        if (page.kind === "sandboxes") {
          setSelected((previous) => Math.max(0, previous - 1));
        } else {
          setSnapshotSelected((previous) => Math.max(0, previous - 1));
        }
        return;
      }
    }

    if (page.kind === "ports") {
      const count = pageDetails?.exposedPorts.length ?? 0;
      if (key.name === "down" || actionKey(key) === "j") {
        setPortSelected((previous) => Math.min(previous + 1, count));
        return;
      }
      if (key.name === "up" || actionKey(key) === "k") {
        setPortSelected((previous) => Math.max(0, previous - 1));
        return;
      }
      if (key.name === "return" && portSelected >= count) {
        runAction("open-port");
        return;
      }
    }

    if (
      page.kind === "sandbox" ||
      page.kind === "snapshot" ||
      page.kind === "ssh-details" ||
      page.kind === "delete-sandbox" ||
      page.kind === "delete-snapshot" ||
      page.kind === "forget-host"
    ) {
      if (key.name === "down" || actionKey(key) === "j") {
        moveAction(1);
        return;
      }
      if (key.name === "up" || actionKey(key) === "k") {
        moveAction(-1);
        return;
      }
      if (key.name === "return") {
        const item = actions[selectedActionIndex];
        if (!item) {
          return;
        }
        if (!item.enabled) {
          showToast("info", item.unavailableReason ?? "This action is unavailable.");
          return;
        }
        runAction(item.id);
        return;
      }
    }

    if (page.kind === "new-sandbox") {
      if (imageMenuOpen) {
        if (key.name === "down" || actionKey(key) === "j") {
          setImageMenuIndex((index) => nextMenuIndex(IMAGE_MENU_OPTIONS, index, 1));
          return;
        }
        if (key.name === "up" || actionKey(key) === "k") {
          setImageMenuIndex((index) => nextMenuIndex(IMAGE_MENU_OPTIONS, index, -1));
          return;
        }
        if (key.name === "return" || key.name === "space") {
          chooseImageOption(imageMenuIndex);
          return;
        }
        if (key.name === "escape") {
          setImageMenuOpen(false);
          return;
        }
        return;
      }
      if (snapshotMenuOpen) {
        if (key.name === "down" || actionKey(key) === "j") {
          setSnapshotMenuIndex((index) => nextMenuIndex(snapshotMenuOptions, index, 1));
          return;
        }
        if (key.name === "up" || actionKey(key) === "k") {
          setSnapshotMenuIndex((index) => nextMenuIndex(snapshotMenuOptions, index, -1));
          return;
        }
        if (key.name === "return" || key.name === "space") {
          chooseSnapshotOption(snapshotMenuIndex);
          return;
        }
        if (key.name === "escape") {
          setSnapshotMenuOpen(false);
          return;
        }
        return;
      }
      if (
        createFocus === "image-dockerfile-mode" &&
        (key.name === "left" || key.name === "right")
      ) {
        setCreateValues((previous) => ({
          ...previous,
          dockerfileMode: toggleDockerfileMode(previous.dockerfileMode),
        }));
        return;
      }
      if (
        key.name === "return" &&
        createFocus === "image-dockerfile" &&
        createValues.dockerfileMode === "paste"
      ) {
        setCreateValues((previous) => ({
          ...previous,
          dockerfileContents: appendText(previous.dockerfileContents, "\n"),
        }));
        return;
      }
      if (key.name === "down" || key.name === "up") {
        const delta = key.name === "down" ? 1 : -1;
        setCreateFocus((current) => nextCreateFocus(createValues, current, delta));
        return;
      }
      if (createFocus === "image" && (key.name === "return" || key.name === "space")) {
        openImageMenu();
        return;
      }
      if (createFocus === "image-snapshot" && (key.name === "return" || key.name === "space")) {
        openSnapshotMenu();
        return;
      }
    }

    if (page.kind === "open-port") {
      if (visibilityMenuOpen) {
        if (key.name === "down" || actionKey(key) === "j") {
          setVisibilityMenuIndex((index) =>
            Math.min(index + 1, PORT_VISIBILITY_OPTIONS.length - 1),
          );
          return;
        }
        if (key.name === "up" || actionKey(key) === "k") {
          setVisibilityMenuIndex((index) => Math.max(0, index - 1));
          return;
        }
        if (key.name === "return" || key.name === "space") {
          chooseVisibility(visibilityMenuIndex);
          return;
        }
        if (key.name === "escape") {
          setVisibilityMenuOpen(false);
          return;
        }
        return;
      }
      if (portForm?.field === "visibility" && (key.name === "return" || key.name === "space")) {
        openVisibilityMenu();
        return;
      }
    }

    if (page.kind === "create-snapshot") {
      if (
        key.name === "tab" ||
        key.name === "backtab" ||
        key.name === "down" ||
        key.name === "up"
      ) {
        const backward =
          key.name === "backtab" || key.name === "up" || (key.name === "tab" && key.shift);
        setCreateSnapshotFocus((current) =>
          nextField(CREATE_SNAPSHOT_FIELDS, current, backward ? -1 : 1),
        );
        return;
      }
      if (
        createSnapshotFocus === "allow-pause" &&
        (key.name === "space" || key.name === "left" || key.name === "right")
      ) {
        setCreateSnapshotAllowPause((value) => !value);
        return;
      }
      if (key.name === "return" && createSnapshotFocus !== "submit") {
        setCreateSnapshotFocus((current) => nextField(CREATE_SNAPSHOT_FIELDS, current, 1));
        return;
      }
    }

    if (page.kind === "new-snapshot") {
      if (
        key.name === "tab" ||
        key.name === "backtab" ||
        key.name === "down" ||
        key.name === "up"
      ) {
        const backward =
          key.name === "backtab" || key.name === "up" || (key.name === "tab" && key.shift);
        setNewSnapshotFocus((current) =>
          nextNewSnapshotFocus(newSnapshotValues, current, backward ? -1 : 1),
        );
        return;
      }
      if (newSnapshotFocus === "source" && (key.name === "left" || key.name === "right")) {
        setNewSnapshotValues((previous) => ({
          ...previous,
          source: toggleSnapshotSource(previous.source),
        }));
        return;
      }
      if (newSnapshotFocus === "dockerfile-mode" && (key.name === "left" || key.name === "right")) {
        setNewSnapshotValues((previous) => ({
          ...previous,
          dockerfileMode: toggleDockerfileMode(previous.dockerfileMode),
        }));
        return;
      }
      if (
        key.name === "return" &&
        newSnapshotFocus === "dockerfile" &&
        newSnapshotValues.dockerfileMode === "paste"
      ) {
        setNewSnapshotValues((previous) => ({
          ...previous,
          dockerfileContents: appendText(previous.dockerfileContents, "\n"),
        }));
        return;
      }
      if (key.name === "return" && newSnapshotFocus !== "submit") {
        setNewSnapshotFocus((current) => nextNewSnapshotFocus(newSnapshotValues, current, 1));
        return;
      }
    }

    if (key.name === "return") {
      if (page.kind === "connect" && connectField !== "submit") {
        setConnectField((previous) => nextField(CONNECT_FIELDS, previous, 1));
        return;
      }
      if (page.kind === "new-sandbox" && createFocus !== "submit") {
        if (createFocus === "size") {
          return;
        }
        setCreateFocus((current) => nextCreateFocus(createValues, current, 1));
        return;
      }
      if (page.kind === "open-port" && portForm && portForm.field !== "submit") {
        if (portForm.field === "port") {
          setPortForm((previous) => (previous ? { ...previous, field: "visibility" } : previous));
        }
        return;
      }
    }

    if (runKeyAction(key)) {
      return;
    }

    if (page.kind === "connect") {
      if (key.name === "tab" || key.name === "backtab" || (key.name === "tab" && key.shift)) {
        const delta = key.name === "backtab" || key.shift ? -1 : 1;
        setConnectField((previous) => nextField(CONNECT_FIELDS, previous, delta));
        return;
      }
      if (key.name === "down") {
        setConnectField((previous) => nextField(CONNECT_FIELDS, previous, 1));
        return;
      }
      if (key.name === "up") {
        setConnectField((previous) => nextField(CONNECT_FIELDS, previous, -1));
        return;
      }
      if (connectField === "submit") {
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

    if (page.kind === "new-sandbox") {
      if (key.name === "tab" || key.name === "backtab" || (key.name === "tab" && key.shift)) {
        const delta = key.name === "backtab" || key.shift ? -1 : 1;
        setCreateFocus((current) => nextCreateFocus(createValues, current, delta));
        return;
      }

      if (createFocus === "size") {
        if (key.name === "left" || key.name === "right") {
          setCreateValues((previous) => ({
            ...previous,
            size: moveSize(previous.size, key.name === "left" ? -1 : 1),
          }));
        }
        return;
      }

      if (createFocus === "image") {
        return;
      }

      if (createFocus === "image-ref") {
        if (key.name === "backspace" || key.name === "delete") {
          setCreateValues((previous) => ({
            ...previous,
            customImage: removeLastChar(previous.customImage),
          }));
          return;
        }
        const char = printableChar(key);
        if (char) {
          setCreateValues((previous) => ({
            ...previous,
            customImage: appendText(previous.customImage, char),
          }));
        }
        return;
      }

      if (createFocus === "image-dockerfile-mode") {
        return;
      }

      if (createFocus === "image-dockerfile") {
        if (createValues.dockerfileMode === "paste") {
          if (key.name === "backspace" || key.name === "delete") {
            setCreateValues((previous) => ({
              ...previous,
              dockerfileContents: removeLastChar(previous.dockerfileContents),
            }));
            return;
          }
          const char = printableChar(key);
          if (char) {
            setCreateValues((previous) => ({
              ...previous,
              dockerfileContents: appendText(previous.dockerfileContents, char),
            }));
          }
          return;
        }
        if (key.name === "backspace" || key.name === "delete") {
          setCreateValues((previous) => ({
            ...previous,
            dockerfilePath: removeLastChar(previous.dockerfilePath),
          }));
          return;
        }
        const char = printableChar(key);
        if (char) {
          setCreateValues((previous) => ({
            ...previous,
            dockerfilePath: appendText(previous.dockerfilePath, char),
          }));
        }
        return;
      }

      const field =
        createFocus === "size-cpu"
          ? "customCpu"
          : createFocus === "size-memory"
            ? "customMemoryGB"
            : createFocus === "size-disk"
              ? "customDiskGB"
              : createFocus === "name"
                ? "name"
                : null;
      if (!field) {
        return;
      }

      if (key.name === "backspace" || key.name === "delete") {
        setCreateValues((previous) => ({
          ...previous,
          [field]: removeLastChar(previous[field]),
        }));
        return;
      }

      const char = printableChar(key);
      if (!char) {
        return;
      }
      if (field === "customCpu" || field === "customMemoryGB") {
        const value = createValues[field];
        if (/^\d$/.test(char) || (char === "." && !value.includes("."))) {
          setCreateValues((previous) => ({ ...previous, [field]: appendText(value, char) }));
        }
      } else if (field === "customDiskGB") {
        if (/^\d$/.test(char)) {
          setCreateValues((previous) => ({
            ...previous,
            customDiskGB: appendText(previous.customDiskGB, char),
          }));
        }
      } else {
        setCreateValues((previous) => ({ ...previous, name: appendText(previous.name, char) }));
      }
      return;
    }

    if (page.kind === "open-port") {
      if (key.name === "tab" || key.name === "backtab" || (key.name === "tab" && key.shift)) {
        const delta = key.name === "backtab" || key.shift ? -1 : 1;
        setPortForm((previous) =>
          previous
            ? { ...previous, field: nextField(PORT_FIELDS, previous.field, delta) }
            : previous,
        );
        return;
      }
      if (key.name === "down" || key.name === "up") {
        const delta = key.name === "down" ? 1 : -1;
        setPortForm((previous) =>
          previous
            ? { ...previous, field: nextField(PORT_FIELDS, previous.field, delta) }
            : previous,
        );
        return;
      }
      if (portForm?.field === "submit") {
        return;
      }
      if (portForm?.field !== "port") {
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
    }

    if (page.kind === "create-snapshot") {
      if (createSnapshotFocus !== "name") {
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        setCreateSnapshotName((previous) => removeLastChar(previous));
        return;
      }
      const char = printableChar(key);
      if (char) {
        setCreateSnapshotName((previous) => appendText(previous, char));
      }
      return;
    }

    if (page.kind === "new-snapshot") {
      switch (newSnapshotFocus) {
        case "source":
        case "submit":
          return;
        case "image-ref": {
          if (key.name === "backspace" || key.name === "delete") {
            setNewSnapshotValues((previous) => ({
              ...previous,
              image: removeLastChar(previous.image),
            }));
            return;
          }
          const char = printableChar(key);
          if (char) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              image: appendText(previous.image, char),
            }));
          }
          return;
        }
        case "dockerfile-mode":
          return;
        case "dockerfile": {
          if (newSnapshotValues.dockerfileMode === "paste") {
            if (key.name === "backspace" || key.name === "delete") {
              setNewSnapshotValues((previous) => ({
                ...previous,
                dockerfileContents: removeLastChar(previous.dockerfileContents),
              }));
              return;
            }
            const char = printableChar(key);
            if (char) {
              setNewSnapshotValues((previous) => ({
                ...previous,
                dockerfileContents: appendText(previous.dockerfileContents, char),
              }));
            }
            return;
          }
          if (key.name === "backspace" || key.name === "delete") {
            setNewSnapshotValues((previous) => ({
              ...previous,
              dockerfilePath: removeLastChar(previous.dockerfilePath),
            }));
            return;
          }
          const char = printableChar(key);
          if (char) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              dockerfilePath: appendText(previous.dockerfilePath, char),
            }));
          }
          return;
        }
        case "cpu":
        case "memory": {
          const field = newSnapshotFocus === "cpu" ? "cpu" : "memoryGB";
          if (key.name === "backspace" || key.name === "delete") {
            setNewSnapshotValues((previous) => ({
              ...previous,
              [field]: removeLastChar(previous[field]),
            }));
            return;
          }
          const char = printableChar(key);
          if (!char) {
            return;
          }
          const value = newSnapshotValues[field];
          if (/^\d$/.test(char) || (char === "." && !value.includes("."))) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              [field]: appendText(value, char),
            }));
          }
          return;
        }
        case "disk": {
          if (key.name === "backspace" || key.name === "delete") {
            setNewSnapshotValues((previous) => ({
              ...previous,
              diskGB: removeLastChar(previous.diskGB),
            }));
            return;
          }
          const char = printableChar(key);
          if (char && /^\d$/.test(char)) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              diskGB: appendText(previous.diskGB, char),
            }));
          }
          return;
        }
        case "name": {
          if (key.name === "backspace" || key.name === "delete") {
            setNewSnapshotValues((previous) => ({
              ...previous,
              name: removeLastChar(previous.name),
            }));
            return;
          }
          const char = printableChar(key);
          if (char) {
            setNewSnapshotValues((previous) => ({
              ...previous,
              name: appendText(previous.name, char),
            }));
          }
          return;
        }
      }
    }
  });

  usePaste((event) => {
    if (booting || page.kind === "ssh-terminal") {
      return;
    }
    event.preventDefault();
    if (busyMessage || connectBusy) {
      return;
    }
    insertPastedText(decodePasteBytes(event.bytes));
  });

  const hints = useMemo<ActionHint[]>(() => {
    if (booting) {
      return [];
    }
    if (page.kind === "ssh-terminal") {
      return terminalStatus
        ? [
            ["esc", "back"],
            ["ctrl+]", "back"],
          ]
        : [["ctrl+]", "close session"]];
    }
    if (page.kind === "sandboxes" || page.kind === "snapshots") {
      return actionHints(actions, {
        extra: [
          ["↑/↓", "move"],
          ["tab", "switch tab"],
          ["1/2", "tabs"],
        ],
      });
    }
    if (page.kind === "ports") {
      return actionHints(actions, { extra: [["↑/↓", "move"]] });
    }
    if (page.kind === "connect") {
      if (connectField === "submit") {
        return actionHints(actions, {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
          ],
        });
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
            ["enter", "next field"],
          ],
        },
      );
    }
    if (page.kind === "create-snapshot") {
      if (createSnapshotFocus === "submit") {
        return actionHints(actions, {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
          ],
        });
      }
      const extra: ActionHint[] = [
        ["↑/↓", "field"],
        ["tab", "next field"],
      ];
      if (createSnapshotFocus === "allow-pause") {
        extra.push(["space", "toggle"], ["enter", "next field"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "new-snapshot") {
      if (newSnapshotFocus === "submit") {
        return actionHints(actions, {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
          ],
        });
      }
      const extra: ActionHint[] = [
        ["↑/↓", "field"],
        ["tab", "next field"],
      ];
      if (newSnapshotFocus === "source") {
        extra.push(["←/→", "source"], ["enter", "next field"]);
      } else if (newSnapshotFocus === "dockerfile-mode") {
        extra.push(["←/→", "mode"], ["enter", "next field"]);
      } else if (
        newSnapshotFocus === "dockerfile" &&
        newSnapshotValues.dockerfileMode === "paste"
      ) {
        extra.push(["enter", "newline"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "new-sandbox") {
      if (imageMenuOpen || snapshotMenuOpen) {
        return [
          ["↑/↓", "move"],
          ["enter", "pick"],
          ["esc", "close"],
        ];
      }
      if (createFocus === "submit") {
        return actionHints(actions, {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
          ],
        });
      }
      const extra: ActionHint[] = [
        ["↑/↓", "field"],
        ["tab", "next field"],
      ];
      if (createFocus === "image" || createFocus === "image-snapshot") {
        extra.push(["enter", "open list"], ["space", "open list"]);
      } else if (createFocus === "image-dockerfile-mode") {
        extra.push(["←/→", "mode"], ["enter", "next field"]);
      } else if (createFocus === "image-dockerfile" && createValues.dockerfileMode === "paste") {
        extra.push(["enter", "newline"]);
      } else if (createFocus === "size") {
        extra.push(["←/→", "preset"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "open-port") {
      if (visibilityMenuOpen) {
        return [
          ["↑/↓", "move"],
          ["enter", "pick"],
          ["esc", "close"],
        ];
      }
      if (portForm?.field === "submit") {
        return actionHints(actions, {
          extra: [
            ["↑/↓", "field"],
            ["tab", "next field"],
          ],
        });
      }
      const focusVisibility = portForm?.field === "visibility";
      const extra: ActionHint[] = [
        ["↑/↓", "field"],
        ["tab", "next field"],
      ];
      if (focusVisibility) {
        extra.push(["enter", "open list"], ["space", "open list"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    return actionHints(actions, {
      selection:
        page.kind === "sandbox" ||
        page.kind === "snapshot" ||
        page.kind === "ssh-details" ||
        page.kind === "delete-sandbox" ||
        page.kind === "delete-snapshot",
    });
  }, [
    booting,
    page.kind,
    actions,
    terminalStatus,
    imageMenuOpen,
    snapshotMenuOpen,
    createFocus,
    visibilityMenuOpen,
    portForm?.field,
    connectField,
    createSnapshotFocus,
    newSnapshotFocus,
    createValues.dockerfileMode,
    newSnapshotValues.dockerfileMode,
  ]);

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
  switch (page.kind) {
    case "connect":
      content = (
        <ConnectScreen
          form={connectForm}
          activeField={connectField}
          busy={connectBusy}
          error={connectError}
          configPath={configPath}
        />
      );
      break;
    case "new-sandbox":
      content = (
        <CreateScreen
          values={createValues}
          focus={createFocus}
          imageMenuOpen={imageMenuOpen}
          imageMenuIndex={imageMenuIndex}
          snapshotMenuOpen={snapshotMenuOpen}
          snapshotMenuIndex={snapshotMenuIndex}
          snapshotMenuOptions={snapshotMenuOptions}
          error={createError}
        />
      );
      break;
    case "sandbox":
      content = (
        <DetailsScreen
          details={pageDetails}
          loading={detailsLoading}
          error={detailsError}
          groups={sandboxGroups}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "ssh-details":
      content = pageDetails ? (
        <SshDetailsScreen
          details={pageDetails}
          gatewayHost={gatewayHost}
          keyPath={detailsKeyPath}
          keyAvailable={keyAvailable}
          knownHostsPath={knownHostsPath ?? "unavailable"}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      ) : (
        <LoadingPanel
          loading={detailsLoading}
          error={detailsError}
          title="SSH details"
          fallback="SSH details are unavailable."
        />
      );
      break;
    case "ports":
      content = (
        <PortsScreen
          details={pageDetails}
          selected={portSelected}
          loading={detailsLoading}
          error={detailsError}
        />
      );
      break;
    case "open-port":
      content = (
        <OpenPortScreen
          form={portForm ?? { field: "port", port: "", visibility: "public" }}
          visibilityMenuOpen={visibilityMenuOpen}
          visibilityMenuIndex={visibilityMenuIndex}
          error={portFormError}
        />
      );
      break;
    case "delete-sandbox":
      content = (
        <DeleteSandboxScreen
          id={page.id}
          label={page.label}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "forget-host":
      content = (
        <ForgetHostScreen
          entry={forgetEntry ?? ""}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "ssh-terminal":
      content = sshArgv ? (
        <SshTerminalScreen
          argv={sshArgv}
          label={page.label}
          statusMessage={terminalStatus}
          onExit={handleSshExit}
          onSessionChange={handleSessionChange}
        />
      ) : (
        <LoadingPanel
          loading={false}
          error="The SSH command could not be built from the configured API URL."
          title="SSH terminal"
          fallback="The SSH terminal is unavailable."
        />
      );
      break;
    case "snapshot":
      content = (
        <SnapshotDetailsScreen
          snapshot={snapshotDetails}
          sandboxes={sandboxes}
          loading={snapshotDetailsLoading}
          error={snapshotDetailsError}
          groups={[{ actions }]}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "delete-snapshot":
      content = (
        <DeleteSnapshotScreen
          name={page.name}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "new-snapshot":
      content = (
        <NewSnapshotScreen
          values={newSnapshotValues}
          focus={newSnapshotFocus}
          error={newSnapshotError}
        />
      );
      break;
    case "create-snapshot":
      content = (
        <CreateSnapshotScreen
          label={page.label}
          name={createSnapshotName}
          allowPause={createSnapshotAllowPause}
          focus={createSnapshotFocus}
          error={createSnapshotError}
        />
      );
      break;
    case "snapshots":
      content = (
        <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0}>
          <HomeTabs active="snapshots" />
          <SnapshotsScreen
            snapshots={snapshots}
            sandboxes={sandboxes}
            selected={snapshotSelected}
            loading={snapshotsLoading}
            error={snapshotsError}
          />
        </box>
      );
      break;
    case "sandboxes":
      content = (
        <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0}>
          <HomeTabs active="sandboxes" />
          <ListScreen
            sandboxes={sandboxes}
            selected={selected}
            loading={listLoading}
            error={listError}
          />
        </box>
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
      <Header
        breadcrumbs={breadcrumbTrail(stack)}
        right={config ? safeHost(config.apiUrl) : undefined}
      />
      <ToastLine toast={toast} />
      {content}
      <BusyLine message={busyMessage} frame={SPINNER_FRAMES[spinnerFrame] ?? SPINNER_FRAMES[0]} />
      <KeyHints hints={hints} />
      {page.kind === "sandboxes" || page.kind === "snapshots" ? (
        <UsageBar summary={usage} updateVersion={updateNotice?.latestVersion} />
      ) : null}
    </box>
  );
}

function LoadingPanel({
  loading,
  error,
  title,
  fallback,
}: {
  loading: boolean;
  error: string | null;
  title: string;
  fallback: string;
}) {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center">
      <box flexDirection="column" gap={1}>
        <text fg={colors.accent}>{title}</text>
        <text fg={loading ? colors.muted : colors.error}>
          {loading ? "Loading…" : (error ?? fallback)}
        </text>
      </box>
    </box>
  );
}
