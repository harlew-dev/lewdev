import {
  type AccountInfo,
  addAuthorizedKey,
  addSshInclude,
  type AuthorizedKey,
  backgroundUpdateCheck,
  cleanupDirectSsh,
  completeRemotePath,
  type CreateSandboxInput,
  deletePrivateKey,
  describeError,
  type DirectSshConfigBlock,
  type DirectSshMode,
  type DirectSshProgress,
  type DirectSshSetupResult,
  DIRECT_SSH_STEPS,
  disableDirectSsh,
  directKeyExists,
  enablePublicDirectSsh,
  ensureSshdRunning,
  openInVscode,
  forgetHostKey,
  formatDirectSshCommand,
  formatExplicitSshCommand,
  type GatewayHostKeyScan,
  getConfigPath,
  getDirectKeyPath,
  getDirectSshAlias,
  getKeyPath,
  getKnownHostsPath,
  getSshConfigPath,
  getSshIncludeLine,
  hasSshInclude,
  isHiddenRemoteName,
  isStandaloneBuild,
  isSshdRunning,
  knownHostsEntry,
  LewdevApi,
  type LewdevConfig,
  loadConfig,
  normalizeApiUrl,
  joinRemotePath,
  parentRemotePath,
  privateKeyExists,
  readAuthorizedKeys,
  readDirectPublicKey,
  readDirectSshConfigBlock,
  type RegisterSnapshotInput,
  removeAuthorizedKey,
  resetDirectSsh,
  resolveRemotePath,
  type SandboxDetails,
  type SandboxFileEntry,
  type SandboxInfo,
  saveConfig,
  saveGatewayHostKeys,
  savePrivateKey,
  scanGatewayHostKeys,
  setupDirectSsh,
  type SnapshotInfo,
  SSH_PORT,
  sshHostFromApiUrl,
  summarizeUsage,
  switchToPrivateSsh,
  type TeamQuotaInfo,
  type TerminalSession,
  type UpdateNotice,
  type UsageSummary,
} from "@lewdev/core";
import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import { decodePasteBytes } from "@opentui/core";
import { useKeyboard, usePaste, useRenderer } from "@opentui/react";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
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
  buildCreateSnapshotConfirmActions,
  buildDeleteActions,
  buildForgetHostActions,
  buildLifecycleActions,
  buildNewSandboxActions,
  buildNewSnapshotActions,
  buildOpenPortActions,
  buildPortsPageActions,
  buildSandboxListActions,
  buildSandboxPageActions,
  buildAddSshKeyActions,
  buildDisableSshActions,
  buildEnablePublicSshActions,
  buildKillSessionActions,
  buildRemoveSshKeyActions,
  buildResetSshActions,
  buildResizeActions,
  buildSandboxPageGroups,
  buildSessionLogActions,
  buildSessionsPageActions,
  buildSetupSshActions,
  buildSnapshotDeleteActions,
  buildSnapshotListActions,
  buildSnapshotPageActions,
  buildSshDetailsActions,
  buildSshIncludeActions,
  buildTrustHostActions,
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
  filterSandboxes,
  filterSnapshots,
  nextSortMode,
  SANDBOX_SORT_MODES,
  SNAPSHOT_SORT_MODES,
  sortSandboxes,
  sortSnapshots,
  type SortMode,
  type SnapshotSortMode,
} from "./list-view";
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
  createLifecycleInput,
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
  toggleStopIdle,
} from "./create-form";
import { CreateScreen } from "./screens/create";
import { ConfirmCreateSnapshotScreen } from "./screens/confirm-create-snapshot";
import { CreateSnapshotScreen, type CreateSnapshotFocus } from "./screens/create-snapshot";
import { AddSshKeyScreen } from "./screens/add-ssh-key";
import { DeleteSandboxScreen } from "./screens/delete-sandbox";
import { DeleteSnapshotScreen } from "./screens/delete-snapshot";
import { DetailsScreen } from "./screens/details";
import { DisableSshScreen } from "./screens/disable-ssh";
import {
  choicesWithCurrent,
  DELETE_IDLE_CHOICES,
  type LifecycleFocus,
  type LifecycleFormValues,
  lifecycleFormFromDetails,
  lifecycleUpdateInput,
  moveLifecycleChoice,
  nextLifecycleFocus,
  restartOnFailureAllowed,
  STOP_IDLE_CHOICES,
  validateLifecycleForm,
} from "./lifecycle-form";
import {
  nextResizeFocus,
  type ResizeFocus,
  type ResizeFormValues,
  resizeSizeInput,
  resizeValuesFromDetails,
} from "./resize-form";
import { LifecycleScreen } from "./screens/lifecycle";
import { KillSessionScreen } from "./screens/kill-session";
import { ResizeScreen } from "./screens/resize";
import { EnablePublicSshScreen } from "./screens/enable-public-ssh";
import { ForgetHostScreen } from "./screens/forget-host";
import { HelpScreen } from "./screens/help";
import { ListScreen } from "./screens/list";
import { NewSnapshotScreen } from "./screens/new-snapshot";
import { OpenPortScreen, type PortFormValues } from "./screens/open-port";
import { PORT_PROTOCOL_OPTIONS, PORT_VISIBILITY_OPTIONS, portAddress } from "./port-options";
import { PortsScreen } from "./screens/ports";
import { RemoveSshKeyScreen } from "./screens/remove-ssh-key";
import { ResetSshScreen } from "./screens/reset-ssh";
import { SessionLogScreen } from "./screens/session-log";
import { SessionsScreen } from "./screens/sessions";
import { SnapshotDetailsScreen } from "./screens/snapshot-details";
import { SnapshotsScreen } from "./screens/snapshots";
import { SetupSshScreen, type SetupSteps } from "./screens/setup-ssh";
import { SshDetailsScreen } from "./screens/ssh-details";
import { SshIncludeScreen } from "./screens/ssh-include";
import { VscodeDirectoryScreen } from "./screens/vscode-directory";
import { TrustHostsScreen } from "./screens/trust-hosts";
import {
  SessionTerminalScreen,
  type TerminalExitResult,
  type TerminalSessionHandle,
} from "./screens/ssh-terminal";
import { tailSessionLog } from "./sessions";
import {
  createSnapshotNeedsConfirmation,
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

/** Selection value for the "+ New …" row at the end of a list. */
const NEW_ROW = "\u0000new";

function isHelpKey(key: KeyEvent): boolean {
  return !key.ctrl && !key.meta && (key.sequence === "?" || key.name === "?");
}

const CONNECT_FIELDS: [ConnectField, ...ConnectField[]] = ["url", "token", "submit"];
const CREATE_SNAPSHOT_FIELDS: [CreateSnapshotFocus, ...CreateSnapshotFocus[]] = ["name", "submit"];

function emptySetupSteps(): SetupSteps {
  return Object.fromEntries(
    DIRECT_SSH_STEPS.map((step) => [step.id, { status: "pending" }]),
  ) as SetupSteps;
}

interface DirectSshInfo {
  keyAvailable: boolean;
  block: DirectSshConfigBlock | null;
  includePresent: boolean;
  sshdRunning: boolean | null;
}

interface VscodeDirState {
  currentDir: string;
  pathInput: string;
  entries: SandboxFileEntry[];
  truncated: boolean;
  loading: boolean;
  error: string | null;
  selected: number;
  showHidden: boolean;
}

const EMPTY_VSCODE_DIR: VscodeDirState = {
  currentDir: "/root",
  pathInput: "/root",
  entries: [],
  truncated: false,
  loading: false,
  error: null,
  selected: 0,
  showHidden: false,
};

function nextField<T>(fields: [T, ...T[]], current: T, delta: number): T {
  const index = fields.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + fields.length) % fields.length;
  return fields[next] ?? fields[0];
}

/** TCP ports have no visibility choice. */
function portFields(form: PortFormValues): [PortFormValues["field"], ...PortFormValues["field"][]] {
  return form.protocol === "tcp"
    ? ["protocol", "port", "submit"]
    : ["protocol", "port", "visibility", "submit"];
}

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
  /** Sandbox ID, NEW_ROW, or null before the first move. */
  const [sandboxSelection, setSandboxSelection] = useState<string | null>(null);
  const [sandboxFilter, setSandboxFilter] = useState("");
  const [sandboxSort, setSandboxSort] = useState<SortMode>("newest");
  const [filterEditing, setFilterEditing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const hasSandboxes = useRef(false);
  const clipboardBusy = useRef(false);

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  /** Snapshot name, NEW_ROW, or null before the first move. */
  const [snapshotSelection, setSnapshotSelection] = useState<string | null>(null);
  const [snapshotFilter, setSnapshotFilter] = useState("");
  const [snapshotSort, setSnapshotSort] = useState<SnapshotSortMode>("newest");
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const hasSnapshots = useRef(false);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);

  const [snapshotDetails, setSnapshotDetails] = useState<SnapshotInfo | null>(null);
  const [snapshotDetailsLoading, setSnapshotDetailsLoading] = useState(false);
  const [snapshotDetailsError, setSnapshotDetailsError] = useState<string | null>(null);

  const [createSnapshotName, setCreateSnapshotName] = useState("");
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

  const [lifecycleValues, setLifecycleValues] = useState<LifecycleFormValues | null>(null);
  const [lifecycleFocus, setLifecycleFocus] = useState<LifecycleFocus>("stop-idle");
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [resizeValues, setResizeValues] = useState<ResizeFormValues | null>(null);
  const [resizeFocus, setResizeFocus] = useState<ResizeFocus>("size");
  const [resizeError, setResizeError] = useState<string | null>(null);

  const [details, setDetails] = useState<SandboxDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [keyAvailable, setKeyAvailable] = useState(false);
  const [portSelected, setPortSelected] = useState(0);
  const [portForm, setPortForm] = useState<PortFormValues | null>(null);
  const [portFormError, setPortFormError] = useState<string | null>(null);
  const [protocolMenuOpen, setProtocolMenuOpen] = useState(false);
  const [protocolMenuIndex, setProtocolMenuIndex] = useState(0);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilityMenuIndex, setVisibilityMenuIndex] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);
  /** The sandbox action the user left from, restored when a sub-page pops back. */
  const sandboxActionRef = useRef<ActionId | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionSelected, setSessionSelected] = useState(0);
  const [sessionLogLines, setSessionLogLines] = useState<string[]>([]);
  const [sessionLogLoading, setSessionLogLoading] = useState(false);
  const [sessionLogError, setSessionLogError] = useState<string | null>(null);
  const sessionLogScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [killSessionError, setKillSessionError] = useState<string | null>(null);
  const [hostKeyScan, setHostKeyScan] = useState<GatewayHostKeyScan | null>(null);

  const [directInfo, setDirectInfo] = useState<DirectSshInfo | null>(null);
  const [authorizedKeys, setAuthorizedKeys] = useState<AuthorizedKey[]>([]);
  const [authorizedKeysLoading, setAuthorizedKeysLoading] = useState(false);
  const [authorizedKeysError, setAuthorizedKeysError] = useState<string | null>(null);
  const [setupSteps, setSetupSteps] = useState<SetupSteps>(emptySetupSteps);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupGuided, setSetupGuided] = useState(false);
  const [setupMode, setSetupMode] = useState<DirectSshMode>("private");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<DirectSshSetupResult | null>(null);
  const [newSshKey, setNewSshKey] = useState("");
  const [addSshKeyError, setAddSshKeyError] = useState<string | null>(null);
  const [sshKeySelected, setSshKeySelected] = useState(0);
  const [removeSshKeyError, setRemoveSshKeyError] = useState<string | null>(null);
  const [vscodeDir, setVscodeDir] = useState<VscodeDirState>(EMPTY_VSCODE_DIR);
  const lastVscodeDir = useRef<Record<string, string>>({});

  const terminalSession = useRef<TerminalSessionHandle | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const page = currentPage(stack);
  const sandboxTarget = pageSandbox(page);
  const sandboxId = sandboxTarget?.id ?? null;
  const sessionLogId = page.kind === "session-log" ? page.sessionId : null;
  const usesDetails =
    page.kind === "sandbox" ||
    page.kind === "resize" ||
    page.kind === "lifecycle" ||
    page.kind === "ssh-details" ||
    page.kind === "setup-ssh" ||
    page.kind === "ssh-include" ||
    page.kind === "add-ssh-key" ||
    page.kind === "remove-ssh-key" ||
    page.kind === "disable-ssh" ||
    page.kind === "reset-ssh" ||
    page.kind === "enable-public-ssh" ||
    page.kind === "vscode-directory" ||
    page.kind === "ports" ||
    page.kind === "open-port";
  const pageDetails = details && details.id === sandboxId ? details : null;
  const visibleSandboxes = useMemo(
    () => sortSandboxes(filterSandboxes(sandboxes, sandboxFilter), sandboxSort),
    [sandboxes, sandboxFilter, sandboxSort],
  );
  const visibleSnapshots = useMemo(
    () => sortSnapshots(filterSnapshots(snapshots, snapshotFilter), snapshotSort),
    [snapshots, snapshotFilter, snapshotSort],
  );
  const sandboxNewSelected = sandboxSelection === NEW_ROW || visibleSandboxes.length === 0;
  const selected = sandboxNewSelected
    ? visibleSandboxes.length
    : Math.max(
        0,
        visibleSandboxes.findIndex((sandbox) => sandbox.id === sandboxSelection),
      );
  const selectedSandbox = sandboxNewSelected ? undefined : visibleSandboxes[selected];
  const snapshotNewSelected = snapshotSelection === NEW_ROW || visibleSnapshots.length === 0;
  const snapshotSelected = snapshotNewSelected
    ? visibleSnapshots.length
    : Math.max(
        0,
        visibleSnapshots.findIndex((snapshot) => snapshot.name === snapshotSelection),
      );
  const selectedSnapshot = snapshotNewSelected ? undefined : visibleSnapshots[snapshotSelected];
  const listFilter = page.kind === "snapshots" ? snapshotFilter : sandboxFilter;
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

  const refreshSessions = useCallback(
    async (showLoading = false): Promise<TerminalSession[]> => {
      if (!api || !sandboxId) {
        return [];
      }
      if (showLoading) {
        setSessionsLoading(true);
      }
      try {
        const items = await api.listSessions(sandboxId);
        setSessions(items);
        setSessionsError(null);
        return items;
      } catch (error) {
        setSessions([]);
        setSessionsError(describeError(error));
        return [];
      } finally {
        if (showLoading) {
          setSessionsLoading(false);
        }
      }
    },
    [api, sandboxId],
  );

  const refreshDirectSshState = useCallback(
    async (id: string, checkRunning: boolean): Promise<void> => {
      try {
        const [keyAvailable, block, includePresent] = await Promise.all([
          directKeyExists(id),
          readDirectSshConfigBlock(id),
          hasSshInclude(),
        ]);
        // The check runs a command in the sandbox, which counts as activity and
        // would hold off idle auto-stop, so it only runs when SSH is set up and
        // a caller needs the answer.
        const sshdRunning =
          checkRunning && block && api ? await isSshdRunning(api, id).catch(() => false) : false;
        setDirectInfo({ keyAvailable, block, includePresent, sshdRunning });
      } catch {
        setDirectInfo({
          keyAvailable: false,
          block: null,
          includePresent: false,
          sshdRunning: false,
        });
      }
    },
    [api],
  );

  const refreshAuthorizedKeys = useCallback(
    async (id: string): Promise<void> => {
      if (!api) {
        return;
      }
      setAuthorizedKeysLoading(true);
      try {
        const publicKey = await readDirectPublicKey(id);
        const keys = await readAuthorizedKeys(api, id, publicKey ?? undefined);
        setAuthorizedKeys(keys);
        setAuthorizedKeysError(null);
      } catch (error) {
        setAuthorizedKeysError(describeError(error));
      } finally {
        setAuthorizedKeysLoading(false);
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
    try {
      terminalSession.current?.detach();
    } catch {
      // The attach stream already closed.
    }
    terminalSession.current = null;
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  const push = useCallback(
    (next: Page) => {
      if (currentPage(stackRef.current).kind === "sandbox") {
        sandboxActionRef.current = selectedActionId;
      }
      setSelectedActionId(null);
      setTerminalStatus(null);
      setStack((previous) => pushPage(previous, next));
    },
    [selectedActionId],
  );

  const pop = useCallback(() => {
    const previous = stackRef.current;
    const destination = previous.length > 1 ? previous[previous.length - 2] : undefined;
    setSelectedActionId(destination?.kind === "sandbox" ? sandboxActionRef.current : null);
    setStack((current) => popPage(current));
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
    if (!api || page.kind !== "sessions") {
      return;
    }
    void refreshSessions(true);
    const timer = setInterval(() => {
      void refreshSessions(false);
    }, 3000);
    return () => {
      clearInterval(timer);
    };
  }, [api, page.kind, refreshSessions]);

  useEffect(() => {
    setSessionSelected((previous) =>
      sessions.length === 0 ? 0 : Math.min(previous, sessions.length - 1),
    );
  }, [sessions.length]);

  useEffect(() => {
    if (sessionLogId === null) {
      setSessionLogLines([]);
      setSessionLogError(null);
      setSessionLogLoading(false);
      return;
    }
    if (!api || !sandboxId) {
      return;
    }
    let cancelled = false;
    setSessionLogLoading(true);
    setSessionLogError(null);
    setSessionLogLines([]);
    void api
      .sessionLog(sandboxId, sessionLogId)
      .then((bytes) => {
        if (!cancelled) {
          setSessionLogLines(tailSessionLog(bytes));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSessionLogError(describeError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSessionLogLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, sandboxId, sessionLogId]);

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
    if (sandboxId === null) {
      return;
    }
    setAuthorizedKeys([]);
    setAuthorizedKeysError(null);
    setSshKeySelected(0);
  }, [sandboxId]);

  const onSshSettings = page.kind === "ssh-details";
  useEffect(() => {
    if (!pageDetails) {
      setDirectInfo(null);
      return;
    }
    void refreshDirectSshState(pageDetails.id, onSshSettings && pageDetails.status === "started");
  }, [pageDetails, onSshSettings, refreshDirectSshState]);

  useEffect(() => {
    if (!sandboxId || (page.kind !== "ssh-details" && page.kind !== "remove-ssh-key")) {
      return;
    }
    void refreshAuthorizedKeys(sandboxId);
  }, [sandboxId, page.kind, refreshAuthorizedKeys]);

  useEffect(() => {
    const count = pageDetails?.exposedPorts.length ?? 0;
    setPortSelected((previous) => Math.min(previous, count));
  }, [pageDetails]);

  useEffect(() => {
    setSshKeySelected((previous) =>
      authorizedKeys.length === 0 ? 0 : Math.min(previous, authorizedKeys.length - 1),
    );
  }, [authorizedKeys.length]);

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

  const directPort = useMemo(
    () =>
      pageDetails?.exposedPorts.find(
        (port) => port.port === 22 && (port.protocol === "tcp" || port.host !== undefined),
      ),
    [pageDetails],
  );

  const directMode = directInfo?.block?.mode ?? null;
  const sshConfigured = directInfo?.block !== null && directInfo?.block !== undefined;
  const directReady = Boolean(
    pageDetails &&
      directInfo?.keyAvailable &&
      directInfo.block &&
      (directInfo.block.mode === "private" || directPort),
  );

  const hasShell =
    pageDetails === null || (pageDetails.runtime !== "wasm" && pageDetails.runtime !== "isolate");

  const directConnection = useMemo(() => {
    if (!pageDetails) {
      return null;
    }
    try {
      const block = directInfo?.block ?? null;
      return {
        alias: getDirectSshAlias(pageDetails.id),
        mode: block?.mode ?? null,
        host: directPort?.host ?? block?.host ?? null,
        port: directPort?.hostPort ?? block?.port ?? null,
        keyPath: getDirectKeyPath(pageDetails.id),
        keyAvailable: directInfo?.keyAvailable ?? false,
        knownHostsPath: getKnownHostsPath(),
        includePresent: directInfo?.includePresent ?? false,
        sshdRunning: directInfo?.sshdRunning ?? null,
        portOpen: directPort !== undefined,
        explicitCommand: block ? formatExplicitSshCommand(block) : null,
      };
    } catch {
      return null;
    }
  }, [pageDetails, directInfo, directPort]);

  const vscodeVisibleEntries = useMemo(
    () =>
      vscodeDir.entries.filter((entry) => vscodeDir.showHidden || !isHiddenRemoteName(entry.name)),
    [vscodeDir.entries, vscodeDir.showHidden],
  );

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

  const actions = useMemo<PageAction[]>(() => {
    const ctx = {
      status: pageDetails?.status ?? null,
      hasShell,
      directReady,
      sshConfigured,
    };
    switch (page.kind) {
      case "sandboxes":
        return buildSandboxListActions();
      case "snapshots":
        return buildSnapshotListActions();
      case "sandbox":
        return buildSandboxPageActions(ctx);
      case "resize":
        return buildResizeActions();
      case "lifecycle":
        return buildLifecycleActions();
      case "snapshot":
        return buildSnapshotPageActions();
      case "delete-snapshot":
        return buildSnapshotDeleteActions();
      case "new-snapshot":
        return buildNewSnapshotActions();
      case "create-snapshot":
        return buildCreateSnapshotActions();
      case "confirm-create-snapshot":
        return buildCreateSnapshotConfirmActions();
      case "ssh-details":
        return buildSshDetailsActions({
          canManageHostKeys: gatewayHost !== null,
          directReady,
          hasKeys: authorizedKeys.length > 0,
          running: pageDetails?.status === "started",
          hasShell,
          mode: directMode,
        });
      case "setup-ssh":
        return buildSetupSshActions({
          running: setupRunning,
          completed: setupResult !== null,
          failed: setupError !== null,
          mode: setupMode,
          guided: setupGuided,
        });
      case "enable-public-ssh":
        return buildEnablePublicSshActions();
      case "vscode-directory":
        return [];
      case "ssh-include":
        return buildSshIncludeActions();
      case "add-ssh-key":
        return buildAddSshKeyActions();
      case "remove-ssh-key":
        return buildRemoveSshKeyActions({
          hasKeys: authorizedKeys.length > 0,
          isLewdev: authorizedKeys[sshKeySelected]?.isLewdev === true,
        });
      case "disable-ssh":
        return buildDisableSshActions();
      case "reset-ssh":
        return buildResetSshActions();
      case "trust-hosts":
        return buildTrustHostActions();
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
      case "sessions":
        return buildSessionsPageActions({
          sessions,
          selected: sessions[sessionSelected],
        });
      case "session-log":
        return buildSessionLogActions();
      case "kill-session":
        return buildKillSessionActions();
      case "ssh-terminal":
        return [];
    }
  }, [
    page,
    pageDetails,
    config,
    portSelected,
    hasShell,
    directReady,
    directMode,
    sshConfigured,
    authorizedKeys,
    sshKeySelected,
    setupRunning,
    setupGuided,
    setupMode,
    setupResult,
    setupError,
    gatewayHost,
    sessions,
    sessionSelected,
  ]);

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
    if (currentPage(stackRef.current).kind === "sandbox") {
      sandboxActionRef.current = selectedActionId;
    }
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
        if (!selectedSandbox) {
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
      case "resize": {
        const target = actionTarget();
        if (target && pageDetails) {
          setResizeValues(resizeValuesFromDetails(pageDetails));
          setResizeFocus("size");
          setResizeError(null);
          pushSandboxScoped({ kind: "resize", ...target });
        }
        return;
      }
      case "lifecycle": {
        const target = actionTarget();
        if (target && pageDetails) {
          const values = lifecycleFormFromDetails(pageDetails.lifecycle);
          if (!restartOnFailureAllowed(pageDetails.runtime)) {
            values.restartOnFailure = false;
          }
          setLifecycleValues(values);
          setLifecycleFocus("stop-idle");
          setLifecycleError(null);
          pushSandboxScoped({ kind: "lifecycle", ...target });
        }
        return;
      }
      case "ssh":
        openTerminal();
        return;
      case "sessions": {
        const target = actionTarget();
        if (target) {
          setSessions([]);
          setSessionsLoading(true);
          setSessionSelected(0);
          setSessionsError(null);
          pushSandboxScoped({ kind: "sessions", ...target });
        }
        return;
      }
      case "attach-session": {
        const target = actionTarget();
        const session = sessions[sessionSelected];
        if (target && session) {
          pushSandboxScoped({ kind: "ssh-terminal", ...target, sessionId: session.id });
        }
        return;
      }
      case "view-session": {
        const target = actionTarget();
        const session = sessions[sessionSelected];
        if (target && session) {
          setSessionLogLines([]);
          setSessionLogError(null);
          pushSandboxScoped({
            kind: "session-log",
            ...target,
            sessionId: session.id,
            sessionName: session.name || "session",
          });
        }
        return;
      }
      case "kill-session": {
        const target = actionTarget();
        const session = sessions[sessionSelected];
        if (target && session) {
          setKillSessionError(null);
          pushSandboxScoped({
            kind: "kill-session",
            ...target,
            sessionId: session.id,
            sessionName: session.name || "session",
          });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-kill-session":
        void performKillSession();
        return;
      case "new-shell":
        openTerminal({ newSession: true });
        return;
      case "ssh-info": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "ssh-details", ...target });
        }
        return;
      }
      case "setup-ssh":
        openConnectSsh();
        return;
      case "setup-public-ssh":
        openSetupSsh("public");
        return;
      case "confirm-setup-private":
        void performSetupSsh({ mode: "private" });
        return;
      case "confirm-setup-public":
        void performSetupSsh({ mode: "public" });
        return;
      case "repair-ssh":
        openSetupSsh();
        return;
      case "open-vscode":
        void openInVSCode();
        return;
      case "add-ssh-key": {
        const target = actionTarget();
        if (target) {
          setNewSshKey("");
          setAddSshKeyError(null);
          pushSandboxScoped({ kind: "add-ssh-key", ...target });
        }
        return;
      }
      case "remove-ssh-key": {
        const target = actionTarget();
        if (target) {
          setSshKeySelected(0);
          setRemoveSshKeyError(null);
          pushSandboxScoped({ kind: "remove-ssh-key", ...target });
        }
        return;
      }
      case "confirm-remove-ssh-key":
        void performRemoveSshKey();
        return;
      case "disable-ssh": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "disable-ssh", ...target });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-disable-ssh":
        void performDisableSsh();
        return;
      case "reset-ssh": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "reset-ssh", ...target });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-reset-ssh":
        void performResetSsh();
        return;
      case "enable-public-ssh": {
        const target = actionTarget();
        if (target) {
          pushSandboxScoped({ kind: "enable-public-ssh", ...target });
          setSelectedActionId("back");
        }
        return;
      }
      case "confirm-enable-public-ssh":
        void performEnablePublicSsh();
        return;
      case "use-private-ssh":
        void performUsePrivateSsh();
        return;
      case "confirm-include":
        void performInclude();
        return;
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
      case "trust-hosts":
        void startTrustHosts();
        return;
      case "confirm-trust-hosts":
        void performTrustHosts();
        return;
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
          setCreateSnapshotFocus("name");
          setCreateSnapshotError(null);
          pushSandboxScoped({ kind: "create-snapshot", ...target });
        }
        return;
      }
      case "confirm-create-snapshot":
        void performCreateSnapshot();
        return;
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
          setPortForm({ field: "protocol", port: "", protocol: "http", visibility: "public" });
          setPortFormError(null);
          setProtocolMenuOpen(false);
          setProtocolMenuIndex(0);
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

  function openTerminal(options: { sessionId?: string; newSession?: boolean } = {}): void {
    const target = actionTarget();
    if (!target) {
      return;
    }
    pushSandboxScoped({ kind: "ssh-terminal", ...target, ...options });
  }

  function leaveTerminal(detached: boolean): void {
    const target = pageSandbox(page);
    try {
      terminalSession.current?.detach();
    } catch {
      // The attach stream already closed.
    }
    terminalSession.current = null;
    setTerminalStatus(null);
    if (detached) {
      showToast("info", "Detached. The session keeps running; Open terminal reattaches.");
    }
    if (!target) {
      return;
    }
    setSelectedActionId(sandboxActionRef.current);
    setStack((previous) => backFromTerminal(previous, target));
    void refreshList(false);
    void loadDetails(target.id);
    void refreshSessions(false);
  }

  const handleTerminalExit = useCallback((result: TerminalExitResult) => {
    const top = currentPage(stackRef.current);
    if (top.kind !== "ssh-terminal") {
      return;
    }
    if (result.error) {
      const detail = result.error.replace(/\.\s*$/, "");
      setTerminalStatus(`Terminal error: ${detail}. Press esc to go back.`);
      return;
    }
    if (result.code !== null && result.code !== 0) {
      setTerminalStatus(`Session ended with exit code ${result.code}. Press esc to go back.`);
      return;
    }
    setTerminalStatus("Session ended. Press esc to go back.");
  }, []);

  const handleSessionChange = useCallback((session: TerminalSessionHandle | null) => {
    terminalSession.current = session;
  }, []);

  function openSetupSsh(requestedMode?: DirectSshMode): void {
    const target = actionTarget();
    if (!target) {
      return;
    }
    const mode = requestedMode ?? directInfo?.block?.mode ?? "private";
    setSetupGuided(false);
    setSetupMode(mode);
    setSetupSteps(emptySetupSteps());
    setSetupRunning(false);
    setSetupError(null);
    setSetupResult(null);
    pushSandboxScoped({ kind: "setup-ssh", ...target });
    setSelectedActionId(mode === "public" ? "confirm-setup-public" : "confirm-setup-private");
  }

  function openConnectSsh(): void {
    const target = actionTarget();
    if (!target) {
      return;
    }
    setSetupGuided(true);
    setSetupMode("private");
    setSetupSteps(emptySetupSteps());
    setSetupRunning(false);
    setSetupError(null);
    setSetupResult(null);
    pushSandboxScoped({ kind: "setup-ssh", ...target });
    void performSetupSsh({ target, mode: "private", guided: true });
  }

  async function performSetupSsh(
    options: {
      reset?: boolean;
      mode?: DirectSshMode;
      target?: SandboxPageTarget;
      guided?: boolean;
    } = {},
  ): Promise<void> {
    const target =
      options.target ??
      (page.kind === "setup-ssh" || page.kind === "reset-ssh" ? pageSandbox(page) : null);
    if (!api || !target || setupRunning) {
      return;
    }
    const guided = options.guided ?? setupGuided;
    const mode = options.mode ?? directInfo?.block?.mode ?? "private";
    setSetupMode(mode);
    setSetupSteps(emptySetupSteps());
    setSetupError(null);
    setSetupResult(null);
    setSetupRunning(true);
    try {
      const onProgress = (progress: DirectSshProgress) => {
        setSetupSteps((previous) => ({
          ...previous,
          [progress.step]: {
            status: progress.status,
            ...(progress.message === undefined ? {} : { message: progress.message }),
          },
        }));
      };
      const result = options.reset
        ? await resetDirectSsh(api, target.id, { onProgress, mode })
        : await setupDirectSsh(api, target.id, { onProgress, mode });
      setSetupResult(result);
      if (guided) {
        // The sandbox action that started this flow no longer exists once SSH is
        // set up; land on the first available action when we return.
        sandboxActionRef.current = null;
      }
      await loadDetails(target.id);
      await refreshDirectSshState(target.id, true);
      await refreshAuthorizedKeys(target.id);
      if (!result.includePresent) {
        pushSandboxScoped({ kind: "ssh-include", purpose: guided ? "vscode" : "setup", ...target });
      } else if (guided) {
        await openVscodeDirectory(target);
      } else {
        showToast("success", "Direct SSH is ready.");
      }
    } catch (error) {
      setSetupError(describeError(error));
    } finally {
      setSetupRunning(false);
    }
  }

  async function performResetSsh(): Promise<void> {
    const target = page.kind === "reset-ssh" ? pageSandbox(page) : null;
    if (!api || !target) {
      return;
    }
    setSetupSteps(emptySetupSteps());
    setSetupError(null);
    setSetupResult(null);
    setSelectedActionId(null);
    const mode = directInfo?.block?.mode ?? "private";
    setSetupGuided(false);
    setSetupMode(mode);
    setStack((previous) => [...popPage(previous), { kind: "setup-ssh", ...target }]);
    await performSetupSsh({ reset: true, mode, target, guided: false });
  }

  async function performEnablePublicSsh(): Promise<void> {
    const target = page.kind === "enable-public-ssh" ? pageSandbox(page) : null;
    if (!api || !target) {
      return;
    }
    setBusyMessage("Enabling public TCP SSH…");
    try {
      await enablePublicDirectSsh(api, target.id);
      await loadDetails(target.id);
      await refreshDirectSshState(target.id, true);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("warning", "SSH now listens on a public TCP port. Login stays key-only.");
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performUsePrivateSsh(): Promise<void> {
    const target = actionTarget();
    if (!api || !target) {
      return;
    }
    setBusyMessage("Switching SSH to the private connection…");
    try {
      await switchToPrivateSsh(api, target.id);
      await loadDetails(target.id);
      await refreshDirectSshState(target.id, true);
      setSelectedActionId(null);
      showToast("success", "SSH now uses the private AerolVM API connection.");
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performInclude(): Promise<void> {
    if (page.kind !== "ssh-include") {
      return;
    }
    const target = pageSandbox(page);
    const purpose = page.purpose;
    setBusyMessage("Adding lewdev's SSH config Include…");
    try {
      const added = await addSshInclude();
      setDirectInfo((previous) =>
        previous === null ? previous : { ...previous, includePresent: true },
      );
      setSetupResult((previous) =>
        previous === null ? previous : { ...previous, includePresent: true },
      );
      setStack((previous) => popPage(previous));
      showToast(
        "success",
        added ? "Added lewdev's Include to ~/.ssh/config." : "lewdev's Include is already present.",
      );
      if (purpose === "vscode" && target) {
        await openVscodeDirectory(target);
      }
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function openInVSCode(): Promise<void> {
    const target = actionTarget();
    if (!api || !target) {
      return;
    }
    if (!directReady) {
      showToast("error", 'SSH is not working. Choose "Repair SSH" in SSH settings.');
      return;
    }
    try {
      if (!(await hasSshInclude())) {
        setDirectInfo((previous) =>
          previous === null ? previous : { ...previous, includePresent: false },
        );
        pushSandboxScoped({ kind: "ssh-include", purpose: "vscode", ...target });
        return;
      }
      if (directMode === "public") {
        await ensureSshdRunning(api, target.id);
      }
      await openVscodeDirectory(target);
    } catch (error) {
      showToast("error", describeError(error));
    }
  }

  async function openVscodeDirectory(target: SandboxPageTarget): Promise<void> {
    const start = lastVscodeDir.current[target.id] ?? "/root";
    setVscodeDir({
      ...EMPTY_VSCODE_DIR,
      currentDir: start,
      pathInput: start,
      loading: true,
    });
    if (currentPage(stackRef.current).kind === "sandbox") {
      sandboxActionRef.current = selectedActionId;
    }
    // The guided connect flow runs on a transient setup page; opening the
    // picker replaces it so cancelling the picker lands on the sandbox page.
    setSelectedActionId(null);
    setStack((previous) => {
      const base = currentPage(previous).kind === "setup-ssh" ? popPage(previous) : previous;
      return pushScopedPage(base, { kind: "vscode-directory", ...target });
    });
    const loaded = await loadVscodeDirectory(target.id, start);
    if (!loaded) {
      await loadVscodeDirectory(target.id, "/");
    }
  }

  /** Lists the folders in a sandbox directory, following symlinks to folders. */
  async function listRemoteFolders(
    sandboxId: string,
    path: string,
  ): Promise<{ entries: SandboxFileEntry[]; truncated: boolean }> {
    if (!api) {
      return { entries: [], truncated: false };
    }
    const client = api;
    const listing = await client.listFiles(sandboxId, path, { limit: 2000 });
    const candidates = listing.entries.filter(
      (entry) => entry.isDir || entry.symlinkTarget !== undefined,
    );
    const folders = await Promise.all(
      candidates.map(async (entry) => {
        if (entry.isDir) {
          return entry;
        }
        try {
          const info = await client.getFileInfo(sandboxId, entry.path);
          return info.isDir ? entry : null;
        } catch {
          return null;
        }
      }),
    );
    const entries = folders
      .filter((entry): entry is SandboxFileEntry => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { entries, truncated: listing.truncated };
  }

  /** Tab: completes the typed path's last segment from the folders of its parent. */
  async function completeVscodePath(sandboxId: string): Promise<void> {
    const input = vscodeDir.pathInput;
    const slash = input.lastIndexOf("/");
    const partial = slash < 0 ? input : input.slice(slash + 1);
    const parent = resolveRemotePath(
      vscodeDir.currentDir,
      slash < 0 ? "." : input.slice(0, slash + 1),
    );
    const showHidden = vscodeDir.showHidden || partial.startsWith(".");
    let entries = vscodeDir.entries;
    if (parent !== vscodeDir.currentDir) {
      try {
        entries = (await listRemoteFolders(sandboxId, parent)).entries;
      } catch {
        return;
      }
    }
    const names = entries
      .map((entry) => entry.name)
      .filter((name) => showHidden || !isHiddenRemoteName(name));
    setVscodeDir((previous) =>
      previous.pathInput === input
        ? { ...previous, pathInput: completeRemotePath(input, names) }
        : previous,
    );
  }

  async function loadVscodeDirectory(sandboxId: string, path: string): Promise<boolean> {
    setVscodeDir((previous) => ({
      ...previous,
      currentDir: path,
      pathInput: path,
      loading: true,
      error: null,
      selected: 0,
    }));
    if (!api) {
      return false;
    }
    try {
      const { entries, truncated } = await listRemoteFolders(sandboxId, path);
      setVscodeDir((previous) => ({
        ...previous,
        currentDir: path,
        pathInput: path,
        entries,
        truncated,
        loading: false,
        error: null,
        selected: 0,
      }));
      return true;
    } catch (error) {
      setVscodeDir((previous) => ({
        ...previous,
        entries: [],
        truncated: false,
        loading: false,
        error: describeError(error),
        selected: 0,
      }));
      return false;
    }
  }

  async function launchVscodeDirectory(): Promise<void> {
    const target = pageSandbox(page);
    if (!api || !target) {
      return;
    }
    try {
      if (directMode === "public") {
        await ensureSshdRunning(api, target.id);
      }
      lastVscodeDir.current[target.id] = vscodeDir.currentDir;
      launchVSCode(target.id, vscodeDir.currentDir);
    } catch (error) {
      showToast("error", describeError(error));
    }
  }

  function launchVSCode(sandboxId: string, directory: string): void {
    openInVscode(sandboxId, directory).then(
      () => showToast("info", "Opening VS Code. The Remote - SSH extension is required."),
      (error: unknown) => showToast("error", describeError(error)),
    );
  }

  async function copySshCommand(): Promise<void> {
    const target = actionTarget();
    if (!target) {
      return;
    }
    try {
      const block = directInfo?.block ?? (await readDirectSshConfigBlock(target.id));
      const include = await hasSshInclude();
      let command: string | null = null;
      if (include) {
        command = formatDirectSshCommand(target.id);
      } else if (directReady && block) {
        command = formatExplicitSshCommand(block);
      }
      if (!command) {
        showToast("error", 'SSH is not ready. Choose "Repair SSH" in SSH settings.');
        return;
      }
      const copied = await writeClipboard(command);
      showToast(
        copied ? "success" : "error",
        copied ? `Copied: ${command}` : "Couldn't copy the SSH command. Use your terminal's copy.",
      );
    } catch (error) {
      showToast("error", describeError(error));
    }
  }

  async function submitAddSshKey(): Promise<void> {
    if (!api || page.kind !== "add-ssh-key" || busyMessage) {
      return;
    }
    setAddSshKeyError(null);
    if (!newSshKey.trim()) {
      setAddSshKeyError("Paste an OpenSSH public key first.");
      return;
    }
    setBusyMessage("Adding SSH key…");
    try {
      await addAuthorizedKey(api, page.id, newSshKey);
      setNewSshKey("");
      await refreshAuthorizedKeys(page.id);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("success", "Added the SSH key to root's authorized_keys.");
    } catch (error) {
      setAddSshKeyError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performRemoveSshKey(): Promise<void> {
    const target = page.kind === "remove-ssh-key" ? pageSandbox(page) : null;
    const key = authorizedKeys[sshKeySelected];
    if (!api || !target || !key) {
      return;
    }
    setRemoveSshKeyError(null);
    setBusyMessage("Removing SSH key…");
    try {
      await removeAuthorizedKey(api, target.id, key.line);
      await refreshAuthorizedKeys(target.id);
      await refreshDirectSshState(target.id, true);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast(
        "success",
        key.isLewdev
          ? "Removed lewdev's key. Run Connect with VS Code / SSH to restore it."
          : "Removed the SSH key.",
      );
    } catch (error) {
      setRemoveSshKeyError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performDisableSsh(): Promise<void> {
    const target = page.kind === "disable-ssh" ? pageSandbox(page) : null;
    if (!api || !target) {
      return;
    }
    setBusyMessage("Disabling SSH…");
    try {
      await disableDirectSsh(api, target.id);
      await loadDetails(target.id);
      await refreshDirectSshState(target.id, false);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("success", "Direct SSH is disabled.");
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
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

  function openProtocolMenu(): void {
    const index = PORT_PROTOCOL_OPTIONS.findIndex((option) => option.value === portForm?.protocol);
    setProtocolMenuIndex(Math.max(index, 0));
    setProtocolMenuOpen(true);
  }

  function chooseProtocol(index: number): void {
    const option = PORT_PROTOCOL_OPTIONS[index];
    if (!option) {
      return;
    }
    setPortForm((previous) => (previous ? { ...previous, protocol: option.value } : previous));
    setProtocolMenuOpen(false);
    setVisibilityMenuOpen(false);
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
      case "resize":
        void submitResize();
        return;
      case "lifecycle":
        void submitLifecycle();
        return;
      case "new-snapshot":
        void submitNewSnapshot();
        return;
      case "create-snapshot":
        submitCreateSnapshot();
        return;
      case "open-port":
        void submitPort();
        return;
      case "add-ssh-key":
        void submitAddSshKey();
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
      setSandboxSelection(null);
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
      const lifecycle = createLifecycleInput(createValues);
      if (lifecycle !== undefined) {
        input.lifecycle = lifecycle;
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
      if (items.some((sandbox) => sandbox.id === created.sandbox.id)) {
        setSandboxSelection(created.sandbox.id);
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

  async function submitResize(): Promise<void> {
    if (!api || page.kind !== "resize" || busyMessage || !resizeValues) {
      return;
    }
    const target = pageSandbox(page);
    if (!target) {
      return;
    }
    setResizeError(null);

    let input: ReturnType<typeof resizeSizeInput>;
    try {
      input = resizeSizeInput(resizeValues);
      if (input.cpu === undefined && input.memoryMB === undefined && input.diskGB === undefined) {
        throw new Error("Enter a CPU, memory or disk size.");
      }
    } catch (error) {
      setResizeError(describeError(error));
      return;
    }

    setBusyMessage(`Resizing ${target.label}…`);
    try {
      await api.resize(target.id, input);
      await loadDetails(target.id);
      await refreshList(false);
      pop();
      showToast("success", `Resized ${target.label}.`);
    } catch (error) {
      setResizeError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function submitLifecycle(): Promise<void> {
    if (!api || page.kind !== "lifecycle" || busyMessage || !lifecycleValues) {
      return;
    }
    const target = pageSandbox(page);
    if (!target) {
      return;
    }
    const validation = validateLifecycleForm(lifecycleValues);
    if (validation) {
      setLifecycleError(validation);
      return;
    }

    setLifecycleError(null);
    setBusyMessage(`Saving lifecycle for ${target.label}…`);
    try {
      await api.updateLifecycle(target.id, lifecycleUpdateInput(lifecycleValues));
      await loadDetails(target.id);
      await refreshList(false);
      pop();
      showToast("success", `Updated the lifecycle for ${target.label}.`);
    } catch (error) {
      setLifecycleError(describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  function knownSandboxStatus(): SandboxInfo["status"] | null {
    if (pageDetails) {
      return pageDetails.status;
    }
    return sandboxes.find((sandbox) => sandbox.id === sandboxId)?.status ?? null;
  }

  function submitCreateSnapshot(): void {
    if (!api || page.kind !== "create-snapshot" || busyMessage) {
      return;
    }
    const target = pageSandbox(page);
    if (!target) {
      return;
    }
    setCreateSnapshotError(null);
    if (createSnapshotNeedsConfirmation(knownSandboxStatus())) {
      push({ kind: "confirm-create-snapshot", ...target });
      setSelectedActionId("back");
      return;
    }
    void performCreateSnapshot();
  }

  async function performCreateSnapshot(): Promise<void> {
    if (!api || busyMessage) {
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
        allowPause: true,
      });
      setCreateSnapshotName("");
      setCreateSnapshotFocus("name");
      setStack((previous) => {
        let next = previous;
        while (next.length > 1) {
          const top = currentPage(next);
          if (top.kind !== "create-snapshot" && top.kind !== "confirm-create-snapshot") {
            break;
          }
          next = popPage(next);
        }
        return next;
      });
      setSelectedActionId(sandboxActionRef.current);
      showToast("success", `Snapshot ${created.name} created`);
      void refreshSnapshots(false);
    } catch (error) {
      setCreateSnapshotError(describeError(error));
      if (page.kind === "confirm-create-snapshot") {
        setSelectedActionId(null);
        setStack((previous) => popPage(previous));
      }
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
      if (items.some((snapshot) => snapshot.name === created.name)) {
        setSnapshotSelection(created.name);
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

  async function performKillSession(): Promise<void> {
    if (page.kind !== "kill-session" || !api) {
      return;
    }
    const sessionID = page.sessionId;
    const name = page.sessionName;
    setKillSessionError(null);
    setBusyMessage(`Killing session ${name}…`);
    try {
      await api.deleteSession(page.id, sessionID);
      await refreshSessions(false);
      setSelectedActionId(null);
      pop();
      showToast("success", `Killed session ${name}.`);
    } catch (error) {
      setKillSessionError(describeError(error));
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
      const warnings: string[] = [];
      try {
        await deletePrivateKey(target.id);
      } catch (error) {
        warnings.push(`its gateway key could not be deleted: ${describeError(error)}`);
      }
      try {
        await cleanupDirectSsh(target.id);
      } catch (error) {
        warnings.push(`its direct SSH data could not be deleted: ${describeError(error)}`);
      }
      const warning = warnings.length > 0 ? warnings.join("; ") : null;
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

  async function startTrustHosts(): Promise<void> {
    const target = actionTarget();
    const host = gatewayHost;
    if (!target || !host) {
      return;
    }

    setBusyMessage("Scanning gateway host keys…");
    try {
      const scan = await scanGatewayHostKeys(host);
      setHostKeyScan(scan);
      push({ kind: "trust-hosts", ...target });
    } catch (error) {
      showToast("error", describeError(error));
    } finally {
      setBusyMessage(null);
    }
  }

  async function performTrustHosts(): Promise<void> {
    const target = page.kind === "trust-hosts" ? pageSandbox(page) : null;
    const host = gatewayHost;
    const scan = hostKeyScan;
    if (!target || !host || !scan) {
      return;
    }

    const count = scan.keys.length;
    const label = count === 1 ? "the gateway host key" : `${count} gateway host keys`;
    setBusyMessage(`Saving ${label}…`);
    try {
      await saveGatewayHostKeys(host, scan.keys);
      setHostKeyScan(null);
      pop();
      showToast("success", `Saved ${label} for ${scan.entry}.`);
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

    pop();
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
    setBusyMessage(`Opening ${form.protocol === "tcp" ? "TCP " : ""}port ${port}…`);
    try {
      const opened =
        form.protocol === "tcp"
          ? await api.openTcpPort(page.id, port)
          : await api.openPort(page.id, port, form.visibility);
      setPortForm(null);
      await loadDetails(page.id);
      setSelectedActionId(null);
      setStack((previous) => popPage(previous));
      showToast("success", `Port ${port} opened: ${portAddress(opened)}`);
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

  /** Moves the sandbox-list cursor within the filtered rows, ending on "+ New …". */
  function moveSandboxSelection(delta: number): void {
    const next = Math.min(Math.max(selected + delta, 0), visibleSandboxes.length);
    setSandboxSelection(
      next >= visibleSandboxes.length ? NEW_ROW : (visibleSandboxes[next]?.id ?? NEW_ROW),
    );
  }

  /** Moves the snapshot-list cursor within the filtered rows, ending on "+ New …". */
  function moveSnapshotSelection(delta: number): void {
    const next = Math.min(Math.max(snapshotSelected + delta, 0), visibleSnapshots.length);
    setSnapshotSelection(
      next >= visibleSnapshots.length ? NEW_ROW : (visibleSnapshots[next]?.name ?? NEW_ROW),
    );
  }

  function setCurrentFilter(value: string): void {
    if (page.kind === "snapshots") {
      setSnapshotFilter(value);
    } else {
      setSandboxFilter(value);
    }
  }

  /** Single-letter shortcuts stay out of the way while a text field has focus. */
  function textInputFocused(): boolean {
    switch (page.kind) {
      case "sandboxes":
      case "snapshots":
        return filterEditing;
      case "connect":
        return connectField !== "submit";
      case "new-sandbox":
        return (
          createFocus === "name" ||
          createFocus === "image-ref" ||
          createFocus === "image-dockerfile" ||
          createFocus === "size-cpu" ||
          createFocus === "size-memory" ||
          createFocus === "size-disk"
        );
      case "new-snapshot":
        return (
          newSnapshotFocus === "name" ||
          newSnapshotFocus === "image-ref" ||
          newSnapshotFocus === "dockerfile" ||
          newSnapshotFocus === "cpu" ||
          newSnapshotFocus === "memory" ||
          newSnapshotFocus === "disk"
        );
      case "create-snapshot":
        return createSnapshotFocus === "name";
      case "add-ssh-key":
      case "vscode-directory":
        return true;
      case "resize":
        return (
          resizeFocus === "size-cpu" || resizeFocus === "size-memory" || resizeFocus === "size-disk"
        );
      case "open-port":
        return portForm !== null && portForm.field !== "submit";
      default:
        return false;
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

    const text = raw.replace(/[\r\n\t]+/g, " ").trim();
    if (!text) {
      return;
    }

    if (filterEditing && (page.kind === "sandboxes" || page.kind === "snapshots")) {
      setCurrentFilter(appendText(listFilter, text));
      return;
    }

    if (page.kind === "add-ssh-key") {
      setNewSshKey((previous) => appendText(previous, text));
      return;
    }
    if (page.kind === "vscode-directory") {
      setVscodeDir((previous) => ({
        ...previous,
        pathInput: appendText(previous.pathInput, text),
      }));
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
        case "stop-idle":
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
    if (page.kind === "resize" && resizeValues) {
      if (resizeFocus === "size-cpu" || resizeFocus === "size-memory") {
        const field = resizeFocus === "size-cpu" ? "customCpu" : "customMemoryGB";
        const merged = `${resizeValues[field]}${text}`.replace(/[^\d.]/g, "");
        const [whole = "", ...rest] = merged.split(".");
        setResizeValues((previous) =>
          previous
            ? {
                ...previous,
                [field]: rest.length > 0 ? `${whole}.${rest.join("")}` : whole,
              }
            : previous,
        );
        return;
      }
      if (resizeFocus === "size-disk") {
        const digits = text.replace(/\D/g, "");
        if (digits) {
          setResizeValues((previous) =>
            previous
              ? { ...previous, customDiskGB: appendText(previous.customDiskGB, digits) }
              : previous,
          );
        }
      }
      return;
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
      if (pressed === "ctrl+]") {
        key.preventDefault();
        leaveTerminal(!ended);
        return;
      }
      if (ended && pressed === "esc") {
        key.preventDefault();
        leaveTerminal(false);
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
    if (helpOpen) {
      if (key.name === "escape" || isHelpKey(key)) {
        key.preventDefault();
        setHelpOpen(false);
      }
      return;
    }
    if (booting || busyMessage || connectBusy || setupRunning) {
      return;
    }
    if (!textInputFocused() && isHelpKey(key)) {
      key.preventDefault();
      setHelpOpen(true);
      return;
    }

    if (page.kind === "vscode-directory") {
      if (vscodeDir.loading) {
        if (key.name === "escape") {
          pop();
        }
        return;
      }
      const parent = vscodeDir.currentDir !== "/";
      const folderStart = parent ? 2 : 1;
      const rowCount = folderStart + vscodeVisibleEntries.length;
      if (key.ctrl && key.name === "t") {
        key.preventDefault();
        setVscodeDir((previous) => ({
          ...previous,
          showHidden: !previous.showHidden,
          selected: 0,
        }));
        return;
      }
      if (key.name === "down") {
        setVscodeDir((previous) => ({
          ...previous,
          selected: Math.min(previous.selected + 1, Math.max(0, rowCount - 1)),
        }));
        return;
      }
      if (key.name === "up") {
        setVscodeDir((previous) => ({
          ...previous,
          selected: Math.max(0, previous.selected - 1),
        }));
        return;
      }
      if (key.name === "tab") {
        key.preventDefault();
        void completeVscodePath(page.id);
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        key.preventDefault();
        const typed = resolveRemotePath(vscodeDir.currentDir, vscodeDir.pathInput);
        if (typed !== vscodeDir.currentDir) {
          void loadVscodeDirectory(page.id, typed);
          return;
        }
        if (vscodeDir.selected === 0) {
          void launchVscodeDirectory();
          return;
        }
        if (parent && vscodeDir.selected === 1) {
          void loadVscodeDirectory(page.id, parentRemotePath(vscodeDir.currentDir));
          return;
        }
        const folder = vscodeVisibleEntries[vscodeDir.selected - folderStart];
        if (folder) {
          void loadVscodeDirectory(page.id, joinRemotePath(vscodeDir.currentDir, folder.name));
        }
        return;
      }
      if (key.name === "escape") {
        pop();
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        setVscodeDir((previous) => ({
          ...previous,
          pathInput: removeLastChar(previous.pathInput),
        }));
        return;
      }
      const char = printableChar(key);
      if (char) {
        setVscodeDir((previous) => ({
          ...previous,
          pathInput: appendText(previous.pathInput, char),
        }));
      }
      return;
    }

    if (page.kind === "sandboxes" || page.kind === "snapshots") {
      const pressed = actionKey(key);
      if (filterEditing) {
        if (key.name === "escape") {
          key.preventDefault();
          setCurrentFilter("");
          setFilterEditing(false);
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          key.preventDefault();
          setFilterEditing(false);
          return;
        }
        if (key.name === "backspace" || key.name === "delete") {
          setCurrentFilter(removeLastChar(listFilter));
          return;
        }
        if (key.name === "tab" || key.name === "backtab") {
          key.preventDefault();
          setFilterEditing(false);
          setSelectedActionId(null);
          setStack([page.kind === "sandboxes" ? SNAPSHOTS_PAGE : ROOT_PAGE]);
          return;
        }
        const char = printableChar(key);
        if (char) {
          setCurrentFilter(appendText(listFilter, char));
        }
        return;
      }
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
      if (pressed === "/") {
        key.preventDefault();
        setFilterEditing(true);
        return;
      }
      if (pressed === "s") {
        key.preventDefault();
        if (page.kind === "sandboxes") {
          setSandboxSort((current) => nextSortMode(current, SANDBOX_SORT_MODES));
        } else {
          setSnapshotSort((current) => nextSortMode(current, SNAPSHOT_SORT_MODES));
        }
        return;
      }
      if (key.name === "escape" && listFilter.length > 0) {
        key.preventDefault();
        setCurrentFilter("");
        return;
      }
      if (key.name === "down" || pressed === "j") {
        if (page.kind === "sandboxes") {
          moveSandboxSelection(1);
        } else {
          moveSnapshotSelection(1);
        }
        return;
      }
      if (key.name === "up" || pressed === "k") {
        if (page.kind === "sandboxes") {
          moveSandboxSelection(-1);
        } else {
          moveSnapshotSelection(-1);
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

    if (page.kind === "sessions") {
      const last = Math.max(0, sessions.length - 1);
      if (key.name === "down" || actionKey(key) === "j") {
        setSessionSelected((previous) => Math.min(previous + 1, last));
        return;
      }
      if (key.name === "up" || actionKey(key) === "k") {
        setSessionSelected((previous) => Math.max(previous - 1, 0));
        return;
      }
    }

    if (page.kind === "session-log") {
      const scroll = sessionLogScrollRef.current;
      if (key.name === "down" || actionKey(key) === "j") {
        key.preventDefault();
        scroll?.scrollBy(1);
        return;
      }
      if (key.name === "up" || actionKey(key) === "k") {
        key.preventDefault();
        scroll?.scrollBy(-1);
        return;
      }
      if (key.name === "pagedown") {
        key.preventDefault();
        scroll?.scrollBy(10);
        return;
      }
      if (key.name === "pageup") {
        key.preventDefault();
        scroll?.scrollBy(-10);
        return;
      }
      if (key.name === "home") {
        key.preventDefault();
        scroll?.scrollTo(0);
        return;
      }
      if (key.name === "end") {
        key.preventDefault();
        scroll?.scrollTo(Number.POSITIVE_INFINITY);
        return;
      }
    }

    if (page.kind === "add-ssh-key" && !key.ctrl && !key.meta) {
      if (key.name === "backspace" || key.name === "delete") {
        setNewSshKey((previous) => removeLastChar(previous));
        return;
      }
      const char = printableChar(key);
      if (char) {
        setNewSshKey((previous) => appendText(previous, char));
        return;
      }
    }

    if (page.kind === "remove-ssh-key" && (key.name === "left" || key.name === "right")) {
      setSshKeySelected((previous) => {
        if (authorizedKeys.length === 0) {
          return 0;
        }
        const next = previous + (key.name === "left" ? -1 : 1);
        return (next + authorizedKeys.length) % authorizedKeys.length;
      });
      return;
    }

    if (page.kind === "lifecycle" && lifecycleValues) {
      const backward =
        key.name === "backtab" || key.name === "up" || (key.name === "tab" && key.shift);
      if (
        key.name === "down" ||
        key.name === "up" ||
        key.name === "tab" ||
        key.name === "backtab"
      ) {
        setLifecycleFocus((current) =>
          nextLifecycleFocus(lifecycleValues, pageDetails?.runtime, current, backward ? -1 : 1),
        );
        return;
      }
      if (key.name === "left" || key.name === "right") {
        const delta = key.name === "left" ? -1 : 1;
        if (lifecycleFocus === "stop-idle") {
          const choices = choicesWithCurrent(STOP_IDLE_CHOICES, lifecycleValues.stopIdleMS);
          const next = moveLifecycleChoice(choices, lifecycleValues.stopIdleMS, delta);
          setLifecycleValues((previous) =>
            previous
              ? {
                  ...previous,
                  stopIdleMS: next,
                  ...(next === undefined ? { serverless: false } : {}),
                }
              : previous,
          );
          return;
        }
        if (lifecycleFocus === "delete-idle") {
          const choices = choicesWithCurrent(DELETE_IDLE_CHOICES, lifecycleValues.deleteIdleMS);
          const next = moveLifecycleChoice(choices, lifecycleValues.deleteIdleMS, delta);
          setLifecycleValues((previous) =>
            previous ? { ...previous, deleteIdleMS: next } : previous,
          );
          return;
        }
        if (lifecycleFocus === "restart" && restartOnFailureAllowed(pageDetails?.runtime)) {
          setLifecycleValues((previous) =>
            previous ? { ...previous, restartOnFailure: !previous.restartOnFailure } : previous,
          );
          return;
        }
        if (lifecycleFocus === "serverless" && lifecycleValues.stopIdleMS !== undefined) {
          setLifecycleValues((previous) =>
            previous ? { ...previous, serverless: !previous.serverless } : previous,
          );
          return;
        }
      }
      if (
        (key.name === "return" || key.name === "space") &&
        (lifecycleFocus === "restart" || lifecycleFocus === "serverless")
      ) {
        if (lifecycleFocus === "restart" && restartOnFailureAllowed(pageDetails?.runtime)) {
          setLifecycleValues((previous) =>
            previous ? { ...previous, restartOnFailure: !previous.restartOnFailure } : previous,
          );
        } else if (lifecycleFocus === "serverless" && lifecycleValues.stopIdleMS !== undefined) {
          setLifecycleValues((previous) =>
            previous ? { ...previous, serverless: !previous.serverless } : previous,
          );
        }
        return;
      }
      if (key.name === "return" && lifecycleFocus !== "submit") {
        setLifecycleFocus((current) =>
          nextLifecycleFocus(lifecycleValues, pageDetails?.runtime, current, 1),
        );
        return;
      }
    }

    if (page.kind === "resize" && resizeValues) {
      const backward =
        key.name === "backtab" || key.name === "up" || (key.name === "tab" && key.shift);
      if (
        key.name === "down" ||
        key.name === "up" ||
        key.name === "tab" ||
        key.name === "backtab"
      ) {
        setResizeFocus((current) => nextResizeFocus(resizeValues, current, backward ? -1 : 1));
        return;
      }
      if (resizeFocus === "size" && (key.name === "left" || key.name === "right")) {
        setResizeValues((previous) =>
          previous
            ? { ...previous, size: moveSize(previous.size, key.name === "left" ? -1 : 1) }
            : previous,
        );
        return;
      }
      if (key.name === "return" && resizeFocus !== "submit") {
        setResizeFocus((current) => nextResizeFocus(resizeValues, current, 1));
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        const field =
          resizeFocus === "size-cpu"
            ? "customCpu"
            : resizeFocus === "size-memory"
              ? "customMemoryGB"
              : resizeFocus === "size-disk"
                ? "customDiskGB"
                : null;
        if (field) {
          setResizeValues((previous) =>
            previous ? { ...previous, [field]: removeLastChar(previous[field]) } : previous,
          );
          return;
        }
      }
      if (resizeFocus !== "submit" && key.name !== "escape") {
        const char = printableChar(key);
        if (!char) {
          return;
        }
        if (resizeFocus === "size-cpu" || resizeFocus === "size-memory") {
          const field = resizeFocus === "size-cpu" ? "customCpu" : "customMemoryGB";
          const value = resizeValues[field];
          if (/^\d$/.test(char) || (char === "." && !value.includes("."))) {
            setResizeValues((previous) =>
              previous ? { ...previous, [field]: appendText(value, char) } : previous,
            );
          }
          return;
        }
        if (resizeFocus === "size-disk") {
          if (/^\d$/.test(char)) {
            setResizeValues((previous) =>
              previous
                ? { ...previous, customDiskGB: appendText(previous.customDiskGB, char) }
                : previous,
            );
          }
          return;
        }
        return;
      }
    }

    if (
      page.kind === "sandbox" ||
      page.kind === "snapshot" ||
      page.kind === "ssh-details" ||
      page.kind === "setup-ssh" ||
      page.kind === "ssh-include" ||
      page.kind === "add-ssh-key" ||
      page.kind === "remove-ssh-key" ||
      page.kind === "disable-ssh" ||
      page.kind === "reset-ssh" ||
      page.kind === "delete-sandbox" ||
      page.kind === "delete-snapshot" ||
      page.kind === "confirm-create-snapshot" ||
      page.kind === "trust-hosts" ||
      page.kind === "forget-host" ||
      page.kind === "kill-session"
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
      if (protocolMenuOpen) {
        if (key.name === "down" || actionKey(key) === "j") {
          setProtocolMenuIndex((index) => Math.min(index + 1, PORT_PROTOCOL_OPTIONS.length - 1));
          return;
        }
        if (key.name === "up" || actionKey(key) === "k") {
          setProtocolMenuIndex((index) => Math.max(0, index - 1));
          return;
        }
        if (key.name === "return" || key.name === "space") {
          chooseProtocol(protocolMenuIndex);
          return;
        }
        if (key.name === "escape") {
          setProtocolMenuOpen(false);
          return;
        }
        return;
      }
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
      if (portForm?.field === "protocol" && (key.name === "return" || key.name === "space")) {
        openProtocolMenu();
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
        setPortForm((previous) =>
          previous
            ? { ...previous, field: nextField(portFields(previous), previous.field, 1) }
            : previous,
        );
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

      if (createFocus === "stop-idle") {
        if (key.name === "left" || key.name === "right") {
          setCreateValues((previous) => ({
            ...previous,
            stopIdle: toggleStopIdle(previous.stopIdle, key.name === "left" ? -1 : 1),
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
            ? { ...previous, field: nextField(portFields(previous), previous.field, delta) }
            : previous,
        );
        return;
      }
      if (key.name === "down" || key.name === "up") {
        const delta = key.name === "down" ? 1 : -1;
        setPortForm((previous) =>
          previous
            ? { ...previous, field: nextField(portFields(previous), previous.field, delta) }
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
    if (busyMessage || connectBusy || setupRunning) {
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
        : [["ctrl+]", "detach"]];
    }
    if (page.kind === "sandboxes" || page.kind === "snapshots") {
      return actionHints(actions, {
        extra: [
          ["↑/↓", "move"],
          ["/", "filter"],
          ["s", "sort"],
          ["tab", "switch tab"],
          ["1/2", "tabs"],
        ],
      });
    }
    if (page.kind === "ports") {
      return actionHints(actions, { extra: [["↑/↓", "move"]] });
    }
    if (page.kind === "sessions") {
      return actionHints(actions, { extra: [["↑/↓", "session"]] });
    }
    if (page.kind === "session-log") {
      return actionHints(actions, {
        extra: [
          ["↑/↓", "scroll"],
          ["pgup/pgdn", "page"],
          ["home/end", "top / bottom"],
        ],
      });
    }
    if (page.kind === "vscode-directory") {
      return [
        ["↑/↓", "move"],
        ["enter", "open / enter"],
        ["tab", "complete"],
        ["ctrl+t", "hidden"],
        ["esc", "back"],
      ];
    }
    if (page.kind === "remove-ssh-key") {
      return actionHints(actions, {
        extra: [
          ["←/→", "key"],
          ["↑/↓", "action"],
        ],
      });
    }
    if (
      page.kind === "setup-ssh" ||
      page.kind === "ssh-include" ||
      page.kind === "add-ssh-key" ||
      page.kind === "disable-ssh" ||
      page.kind === "reset-ssh"
    ) {
      return actionHints(actions, {
        selection: page.kind !== "add-ssh-key",
      });
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
      extra.push(["enter", "next field"]);
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
      } else if (createFocus === "stop-idle") {
        extra.push(["←/→", "idle time"], ["enter", "next field"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "lifecycle") {
      if (lifecycleFocus === "submit") {
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
        ["←/→", "change"],
      ];
      if (lifecycleFocus === "restart" || lifecycleFocus === "serverless") {
        extra.push(["enter", "toggle"], ["space", "toggle"]);
      } else {
        extra.push(["enter", "next field"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "resize") {
      if (resizeFocus === "submit") {
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
        ["enter", "next field"],
      ];
      if (resizeFocus === "size") {
        extra.push(["←/→", "preset"]);
      }
      return actionHints(
        actions.filter((action) => action.id !== "submit"),
        { extra },
      );
    }
    if (page.kind === "open-port") {
      if (protocolMenuOpen || visibilityMenuOpen) {
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
      const focusMenu = portForm?.field === "protocol" || portForm?.field === "visibility";
      const extra: ActionHint[] = [
        ["↑/↓", "field"],
        ["tab", "next field"],
      ];
      if (focusMenu) {
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
        page.kind === "delete-snapshot" ||
        page.kind === "confirm-create-snapshot" ||
        page.kind === "trust-hosts" ||
        page.kind === "kill-session",
    });
  }, [
    booting,
    page.kind,
    actions,
    terminalStatus,
    imageMenuOpen,
    snapshotMenuOpen,
    createFocus,
    protocolMenuOpen,
    visibilityMenuOpen,
    portForm?.field,
    connectField,
    createSnapshotFocus,
    newSnapshotFocus,
    createValues.dockerfileMode,
    newSnapshotValues.dockerfileMode,
    lifecycleFocus,
    resizeFocus,
  ]);

  const helpGlobalHints = useMemo<ActionHint[]>(() => {
    if (page.kind === "sandboxes" || page.kind === "snapshots") {
      return [
        ["tab", "switch tab"],
        ["1/2", "switch tab"],
        ["/", "filter"],
        ["s", "sort"],
        ["?", "help"],
        ["q", "quit"],
        ["esc", "clear filter / close help"],
      ];
    }
    return [
      ["?", "help"],
      ["esc", "back / close help"],
    ];
  }, [page.kind]);

  const textFocus = textInputFocused();
  const footerHints = useMemo<ActionHint[]>(() => {
    if (booting || page.kind === "ssh-terminal") {
      return hints;
    }
    if (helpOpen) {
      return [
        ["esc", "close help"],
        ["?", "close help"],
      ];
    }
    if (filterEditing) {
      return [
        ["enter", "done"],
        ["esc", "clear filter"],
        ["tab", "switch tab"],
      ];
    }
    if (textFocus) {
      return hints;
    }
    return [...hints, ["?", "help"]];
  }, [booting, hints, page.kind, helpOpen, filterEditing, textFocus]);

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
    case "resize":
      content =
        pageDetails && resizeValues ? (
          <ResizeScreen
            label={page.label}
            values={resizeValues}
            focus={resizeFocus}
            error={resizeError}
          />
        ) : (
          <LoadingPanel
            loading={detailsLoading}
            error={detailsError}
            title="Resize"
            fallback="The sandbox details are unavailable."
          />
        );
      break;
    case "lifecycle":
      content =
        pageDetails && lifecycleValues ? (
          <LifecycleScreen
            label={page.label}
            values={lifecycleValues}
            focus={lifecycleFocus}
            runtime={pageDetails.runtime}
            error={lifecycleError}
          />
        ) : (
          <LoadingPanel
            loading={detailsLoading}
            error={detailsError}
            title="Lifecycle"
            fallback="The sandbox details are unavailable."
          />
        );
      break;
    case "ssh-details":
      content =
        pageDetails && directConnection ? (
          <SshDetailsScreen
            details={pageDetails}
            connection={directConnection}
            keys={authorizedKeys}
            keysLoading={authorizedKeysLoading}
            keysError={authorizedKeysError}
            gatewayHost={gatewayHost}
            gatewayKeyPath={detailsKeyPath}
            gatewayKeyAvailable={keyAvailable}
            gatewayKnownHostsPath={knownHostsPath ?? "unavailable"}
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
    case "setup-ssh":
      content = (
        <SetupSshScreen
          steps={setupSteps}
          mode={setupResult?.mode ?? setupMode}
          running={setupRunning}
          error={setupError}
          result={setupResult}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "ssh-include":
      content = (
        <SshIncludeScreen
          configPath={getSshConfigPath()}
          includeLine={getSshIncludeLine()}
          homeConfigPath={join(homedir(), ".ssh", "config")}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "add-ssh-key":
      content = (
        <AddSshKeyScreen
          value={newSshKey}
          error={addSshKeyError}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "remove-ssh-key":
      content = (
        <RemoveSshKeyScreen
          keys={authorizedKeys}
          selected={sshKeySelected}
          loading={authorizedKeysLoading}
          error={removeSshKeyError ?? authorizedKeysError}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "disable-ssh":
      content = (
        <DisableSshScreen
          label={page.label}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "reset-ssh":
      content = (
        <ResetSshScreen label={page.label} actions={actions} selectedIndex={selectedActionIndex} />
      );
      break;
    case "enable-public-ssh":
      content = (
        <EnablePublicSshScreen
          label={page.label}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "vscode-directory":
      content = (
        <VscodeDirectoryScreen
          currentDir={vscodeDir.currentDir}
          pathInput={vscodeDir.pathInput}
          entries={vscodeVisibleEntries}
          truncated={vscodeDir.truncated}
          loading={vscodeDir.loading}
          error={vscodeDir.error}
          selected={vscodeDir.selected}
          showHidden={vscodeDir.showHidden}
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
          form={
            portForm ?? {
              field: "protocol",
              port: "",
              protocol: "http",
              visibility: "public",
            }
          }
          protocolMenuOpen={protocolMenuOpen}
          protocolMenuIndex={protocolMenuIndex}
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
    case "trust-hosts":
      content = hostKeyScan ? (
        <TrustHostsScreen
          entry={hostKeyScan.entry}
          keys={hostKeyScan.keys}
          failedAddresses={hostKeyScan.failedAddresses}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      ) : (
        <LoadingPanel
          loading={false}
          error="The gateway host keys were not scanned. Start again from SSH settings."
          title="Trust host keys"
          fallback="The gateway host keys are unavailable."
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
    case "sessions":
      content = (
        <SessionsScreen
          sessions={sessions}
          selected={sessionSelected}
          loading={sessionsLoading}
          error={sessionsError}
        />
      );
      break;
    case "session-log":
      content = (
        <SessionLogScreen
          sessionName={page.sessionName}
          lines={sessionLogLines}
          loading={sessionLogLoading}
          error={sessionLogError}
          scrollRef={sessionLogScrollRef}
        />
      );
      break;
    case "kill-session":
      content = (
        <KillSessionScreen
          sessionName={page.sessionName}
          error={killSessionError}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "ssh-terminal":
      content = api ? (
        <SessionTerminalScreen
          api={api}
          sandboxId={page.id}
          {...(page.sessionId === undefined ? {} : { sessionId: page.sessionId })}
          {...(page.newSession === undefined ? {} : { newSession: page.newSession })}
          label={page.label}
          statusMessage={terminalStatus}
          onExit={handleTerminalExit}
          onSessionChange={handleSessionChange}
        />
      ) : (
        <LoadingPanel
          loading={false}
          error="The AerolVM server is not connected."
          title="Terminal"
          fallback="The terminal is unavailable."
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
          focus={createSnapshotFocus}
          error={createSnapshotError}
        />
      );
      break;
    case "confirm-create-snapshot":
      content = (
        <ConfirmCreateSnapshotScreen
          label={page.label}
          actions={actions}
          selectedIndex={selectedActionIndex}
        />
      );
      break;
    case "snapshots":
      content = (
        <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0}>
          <HomeTabs active="snapshots" />
          <SnapshotsScreen
            snapshots={visibleSnapshots}
            sandboxes={sandboxes}
            totalCount={snapshots.length}
            selected={snapshotSelected}
            filter={snapshotFilter}
            filterEditing={filterEditing}
            sort={snapshotSort}
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
            sandboxes={visibleSandboxes}
            totalCount={sandboxes.length}
            selected={selected}
            filter={sandboxFilter}
            filterEditing={filterEditing}
            sort={sandboxSort}
            loading={listLoading}
            error={listError}
          />
        </box>
      );
  }

  if (helpOpen) {
    const trail = breadcrumbTrail(stack);
    content = (
      <HelpScreen
        title={trail[trail.length - 1] ?? "lewdev"}
        hints={hints}
        globalHints={helpGlobalHints.filter(([key]) => !hints.some(([pageKey]) => pageKey === key))}
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
      <Header
        breadcrumbs={breadcrumbTrail(stack)}
        right={config ? safeHost(config.apiUrl) : undefined}
      />
      <ToastLine toast={toast} />
      {content}
      <BusyLine message={busyMessage} frame={SPINNER_FRAMES[spinnerFrame] ?? SPINNER_FRAMES[0]} />
      <KeyHints hints={footerHints} />
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
