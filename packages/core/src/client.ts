import {
  type AddCustomDomainOptions,
  type AuditEvent,
  type AuditOptions,
  type AuditPage,
  type BinaryLike,
  type CallOptions,
  type CreateOptions,
  type CreateSessionOptions,
  type CopyFileOptions,
  type CreateSnapshotOptions,
  type CustomDomain,
  type CustomDomainDNSRecords,
  type CustomDomainStatus as SdkCustomDomainStatus,
  type DeleteFileOptions,
  type DNSRecord,
  type DNSRecordType as SdkDNSRecordType,
  type ExecRequest,
  type ExecResult,
  type ExposePortOptions,
  type FileInfo,
  type FileList,
  type FileMatch,
  type IngressTarget,
  type IngressTargetSource as SdkIngressTargetSource,
  type ListFilesOptions,
  type MakeDirOptions,
  type MoveFileOptions,
  type ExposeResult,
  type ExposeVisibility,
  type GetOptions,
  type HealthStatus,
  Image,
  type Lifecycle,
  type ListOptions,
  type ListSnapshotsOptions,
  MicroVM,
  type RegisterSnapshotOptions,
  type ResizeOptions,
  type SandboxSnapshot,
  type SandboxStatus,
  type Session,
  type SessionAttachHandle,
  type SessionAttachOptions,
  type SnapshotList,
  type TeamQuota,
  type UploadFileOptions,
  type WhoAmI,
  type APITokenList,
  type CreateAPITokenOptions,
  type CreatedAPIToken,
} from "@aerol-ai/aerolvm-sdk";

import type { LewdevConfig } from "./config.js";
import { normalizeApiUrl } from "./config.js";

export interface SdkExposedPort {
  port: number;
  publicURL: string;
  visibility?: ExposeVisibility;
  protocol?: "http" | "tcp" | "tls";
}

export interface SdkExecStreamOptions {
  command?: string;
  argv?: string[];
  workdir?: string;
  env?: Record<string, string>;
  tty?: boolean;
  cols?: number;
  rows?: number;
  onStdout?: (chunk: Uint8Array) => void;
  onStderr?: (chunk: Uint8Array) => void;
  onError?: (message: string) => void;
}

export interface SdkExecStreamHandle {
  write(data: Uint8Array | string): void;
  resize(cols: number, rows: number): void;
  signal(name: string): void;
  close(): void;
  done: Promise<{ code: number; signal?: string }>;
}

/** A background terminal session. It keeps running when no client is attached. */
export type TerminalSessionStatus = "running" | "exited" | "killed" | "failed";

/** A terminal session, detached from the SDK's wire type. */
export interface TerminalSession {
  id: string;
  name: string;
  argv: string[];
  workDir?: string;
  pty: boolean;
  status: TerminalSessionStatus;
  exitCode: number;
  exitSignal?: string;
  createdAt: string;
  startedAt: string;
  exitedAt?: string;
  recording: boolean;
  bytes: number;
  attached: number;
}

/** Options for starting a terminal session. A PTY session with no command is a login shell. */
export interface CreateTerminalSessionInput {
  name?: string;
  command?: string;
  argv?: string[];
  workDir?: string;
  env?: Record<string, string>;
  pty?: boolean;
  cols?: number;
  rows?: number;
}

export interface TerminalSessionAttachOptions {
  onStdout?: (chunk: Uint8Array) => void;
  onStderr?: (chunk: Uint8Array) => void;
  onExit?: (info: { code: number; signal?: string }) => void;
  onError?: (message: string) => void;
  cols?: number;
  rows?: number;
}

export interface TerminalSessionAttachHandle {
  write(data: Uint8Array | string): void;
  resize(cols: number, rows: number): void;
  signal(name: string): void;
  /** Detach without killing the session. */
  close(): void;
  done: Promise<{ code: number; signal?: string }>;
}

/** A sandbox execution runtime; WASM and isolate sandboxes have no shell. */
export type SandboxRuntime = "docker" | "gvisor" | "kata" | "firecracker" | "wasm" | "isolate";

/** The container runtimes the New sandbox form offers. */
export type ContainerRuntime = "docker" | "gvisor" | "firecracker";

/** What the server's `/health` reports for one runtime. */
export type RuntimeAvailabilityState = "available" | "off" | "unhealthy" | "unknown";

export interface RuntimeAvailability {
  state: RuntimeAvailabilityState;
  /** The server's status text when it is `unhealthy`. */
  detail?: string;
}

/** `/health` runtime fields for every runtime the create form can offer. */
export interface RuntimeAvailabilityReport {
  docker: RuntimeAvailability;
  gvisor: RuntimeAvailability;
  firecracker: RuntimeAvailability;
}

/** Why the server put the sandbox in its current status. */
export type SandboxStatusReason =
  | "user_stop"
  | "idle"
  | "max_age"
  | "out_of_memory"
  | "disk_limit"
  | "crashed"
  | "reconcile"
  | "program_exited"
  | "failover"
  | "restarted"
  | "failover_disabled"
  | "ownership_lease_expired";

/**
 * A sandbox's automatic stop/delete settings. Durations are milliseconds;
 * the SDK boundary converts them to integer nanoseconds.
 */
export interface SandboxLifecycle {
  stopIfIdleForMS?: number;
  destroyIfIdleForMS?: number;
  stopAtAgeMS?: number;
  destroyAtAgeMS?: number;
  destroyAfterExitForMS?: number;
  /** Resume on the next HTTP request after an idle stop. Requires `stopIfIdleForMS`. */
  serverless?: boolean;
  /** Docker, gVisor and containerd only. */
  restartOnFailure?: boolean;
}

/** The CPU, memory and disk sizes a resize may change. */
export interface ResizeSandboxInput {
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
}

/** The subset of the SDK's sandbox resource that lewdev uses. */
export interface SdkSandbox {
  id: string;
  name?: string;
  image: string;
  status: SandboxStatus;
  publicURL: string;
  cpu: number;
  memoryMB: number;
  diskGB: number;
  osUser: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  sshPublicKey?: string;
  sshPrivateKey?: string;
  exposedPorts?: SdkExposedPort[];
  lastError?: string;
  statusReason?: SandboxStatusReason;
  exitCode?: number;
  lifecycle: Lifecycle;
  tags?: Record<string, string>;
  runtime?: SandboxRuntime | "";
  exposePort(port: number, options?: ExposePortOptions, call?: CallOptions): Promise<ExposeResult>;
  unexposePort(port: number, call?: CallOptions): Promise<void>;
  exec(command: string | ExecRequest, call?: CallOptions): Promise<ExecResult>;
  execStream(options: SdkExecStreamOptions): SdkExecStreamHandle;
  listFiles(path: string, options?: ListFilesOptions, call?: CallOptions): Promise<FileList>;
  getFileInfo(path: string, call?: CallOptions): Promise<FileInfo>;
  fileExists(path: string, call?: CallOptions): Promise<boolean>;
  uploadFile(
    targetPath: string,
    data: BinaryLike,
    options?: UploadFileOptions,
    call?: CallOptions,
  ): Promise<void>;
  uploadFileStream(
    targetPath: string,
    data: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
    options?: UploadFileOptions,
    call?: CallOptions,
  ): Promise<void>;
  uploadDir(localDir: string, remoteDir: string, call?: CallOptions): Promise<void>;
  downloadFile(
    targetPath: string,
    options?: SandboxDownloadOptions,
    call?: CallOptions,
  ): Promise<Uint8Array>;
  downloadFileStream(
    targetPath: string,
    options?: SandboxDownloadOptions,
    call?: CallOptions,
  ): Promise<ReadableStream<Uint8Array>>;
  deleteFile(path: string, options?: DeleteFileOptions, call?: CallOptions): Promise<void>;
  makeDir(path: string, options?: MakeDirOptions, call?: CallOptions): Promise<void>;
  moveFile(
    source: string,
    destination: string,
    options?: MoveFileOptions,
    call?: CallOptions,
  ): Promise<void>;
  copyFile(
    source: string,
    destination: string,
    options?: CopyFileOptions,
    call?: CallOptions,
  ): Promise<void>;
  searchFiles(path: string, pattern: string, call?: CallOptions): Promise<string[]>;
  findInFiles(path: string, text: string, call?: CallOptions): Promise<FileMatch[]>;
  /** Per-sandbox custom-hostname bindings. */
  customDomains: {
    add(
      hostname: string,
      options?: AddCustomDomainOptions,
      call?: CallOptions,
    ): Promise<CustomDomain[]>;
    remove(hostname: string, call?: CallOptions): Promise<void>;
    list(call?: CallOptions): Promise<CustomDomain[]>;
    dns(call?: CallOptions): Promise<CustomDomainDNSRecords>;
  };
  getNetworkUsage(call?: CallOptions): Promise<SdkNetworkUsage>;
  setNetworkLimits(
    options: SdkSetNetworkLimitsOptions,
    call?: CallOptions,
  ): Promise<SdkNetworkUsage>;
  audit(options?: AuditOptions, call?: CallOptions): Promise<AuditPage>;
}

/** The subset of `MicroVM` that lewdev depends on. Tests inject a fake. */
export interface AerolSdk {
  create(options: CreateOptions, call?: CallOptions): Promise<SdkSandbox>;
  list(options?: ListOptions, call?: CallOptions): Promise<SdkSandbox[]>;
  get(id: string, options?: GetOptions, call?: CallOptions): Promise<SdkSandbox>;
  start(id: string, call?: CallOptions): Promise<SdkSandbox>;
  stop(id: string, call?: CallOptions): Promise<SdkSandbox>;
  destroy(id: string, call?: CallOptions): Promise<void>;
  resize(id: string, options: ResizeOptions, call?: CallOptions): Promise<SdkSandbox>;
  updateLifecycle(id: string, lifecycle: Lifecycle, call?: CallOptions): Promise<SdkSandbox>;
  health(call?: CallOptions): Promise<HealthStatus>;
  /** The cluster's ingress address(es), the target for custom-domain DNS. */
  dns: {
    target(call?: CallOptions): Promise<IngressTarget>;
  };
  createSession(id: string, options: CreateSessionOptions, call?: CallOptions): Promise<Session>;
  listSessions(id: string, call?: CallOptions): Promise<Session[]>;
  getSession(id: string, sessionID: string, call?: CallOptions): Promise<Session>;
  deleteSession(id: string, sessionID: string, call?: CallOptions): Promise<void>;
  signalSession(id: string, sessionID: string, signal: string, call?: CallOptions): Promise<void>;
  resizeSession(
    id: string,
    sessionID: string,
    cols: number,
    rows: number,
    call?: CallOptions,
  ): Promise<void>;
  sessionLog(id: string, sessionID: string, call?: CallOptions): Promise<Uint8Array>;
  attachSession(id: string, sessionID: string, options?: SessionAttachOptions): SessionAttachHandle;
  createSnapshot(
    id: string,
    name: string,
    options?: CreateSnapshotOptions,
    call?: CallOptions,
  ): Promise<SandboxSnapshot>;
  registerSnapshot(options: RegisterSnapshotOptions, call?: CallOptions): Promise<SandboxSnapshot>;
  getSnapshot(name: string, call?: CallOptions): Promise<SandboxSnapshot>;
  listSnapshots(options?: ListSnapshotsOptions, call?: CallOptions): Promise<SnapshotList>;
  deleteSnapshot(name: string, call?: CallOptions): Promise<void>;
  whoami(call?: CallOptions): Promise<WhoAmI>;
  getTeamQuota(team: string, call?: CallOptions): Promise<TeamQuota>;
  tokens: {
    create(options: CreateAPITokenOptions, call?: CallOptions): Promise<CreatedAPIToken>;
    list(call?: CallOptions): Promise<APITokenList>;
    revoke(id: string, call?: CallOptions): Promise<void>;
  };
}

export type PortVisibility = Extract<ExposeVisibility, "public" | "token">;

export interface ExposedPortInfo {
  port: number;
  url: string;
  visibility?: PortVisibility;
  protocol?: "http" | "tcp" | "tls";
  /** Raw-TCP exposures only. */
  host?: string;
  hostPort?: number;
}

export interface SandboxInfo {
  id: string;
  name?: string;
  image: string;
  status: SandboxStatus;
  cpu: number;
  memoryMB: number;
  diskGB: number;
  createdAt: string;
  publicURL: string;
  exposedPorts: ExposedPortInfo[];
  lastError?: string;
  runtime?: SandboxRuntime | "";
}

export interface SandboxDetails extends SandboxInfo {
  osUser: string;
  updatedAt: string;
  lastActiveAt: string;
  sshPublicKey?: string;
  statusReason?: SandboxStatusReason;
  exitCode?: number;
  lifecycle: SandboxLifecycle;
  tags: Record<string, string>;
}

export interface CreateSandboxInput {
  /** A base image reference. Mutually exclusive with `dockerfile`. */
  image?: string;
  /** Dockerfile contents. Mutually exclusive with `image`. */
  dockerfile?: string;
  name?: string;
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
  lifecycle?: SandboxLifecycle;
  /** Omit to use the server's default runtime. */
  runtime?: ContainerRuntime;
}

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface SandboxExecStreamOptions {
  command: string;
  onStdout?: (chunk: Uint8Array) => void;
  onStderr?: (chunk: Uint8Array) => void;
  onError?: (message: string) => void;
}

export interface SandboxExecStreamHandle {
  write(data: Uint8Array | string): void;
  close(): void;
  signal(name: string): void;
  done: Promise<{ code: number; signal?: string }>;
}

export interface SandboxFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  symlinkTarget?: string;
  /** Bytes, when the server reports them. */
  size?: number;
  /** Last change time, RFC 3339 in UTC, when the server reports it. */
  modTime?: string;
  /** Type and permission string, such as `-rw-r--r--`. */
  mode?: string;
  /** Octal permission bits, such as `0644`. */
  permissions?: string;
  owner?: string;
  group?: string;
}

export interface SandboxFileList {
  entries: SandboxFileEntry[];
  truncated: boolean;
}

export interface SandboxFileInfo extends SandboxFileEntry {}

/** One line `findInFiles` found inside a sandbox file. */
export interface SandboxFileMatch {
  file: string;
  line: number;
  content: string;
}

/** How an upload writes its sandbox file. Every field is off by default. */
export interface SandboxUploadOptions {
  append?: boolean;
  createOnly?: boolean;
  atomic?: boolean;
  mode?: number;
}

export interface SandboxDownloadOptions {
  /** Refuse files larger than this many bytes. */
  maxBytes?: number;
}

export interface SandboxDeleteOptions {
  /** Delete a folder and everything in it. */
  recursive?: boolean;
}

export interface SandboxMakeDirOptions {
  /** Also make missing parent folders, and accept an existing folder. */
  parents?: boolean;
  mode?: number;
}

export interface SandboxMoveOptions {
  /** Replace an existing destination. */
  overwrite?: boolean;
}

export interface SandboxCopyOptions {
  /** Replace an existing destination. */
  overwrite?: boolean;
  /** Copy a folder and everything in it. */
  recursive?: boolean;
}

/** The upload source accepted by the SDK: a byte stream or an async iterable. */
export type SandboxUploadData = AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>;

/**
 * The SDK's network-usage wire shape. Version 0.8.3 does not re-export it from
 * the package root, so lewdev keeps its own structural copy.
 */
interface SdkNetworkUsage {
  sandboxID: string;
  bytesIn: number;
  bytesOut: number;
  bytesInLimit: number;
  bytesOutLimit: number;
  quotaExceeded: boolean;
  quotaExceededAt?: string;
  lastSampledAt?: string;
}

/** The SDK's options for `setNetworkLimits`, which 0.8.3 does not re-export. */
interface SdkSetNetworkLimitsOptions {
  networkBytesInLimit?: number;
  networkBytesOutLimit?: number;
}

/** A custom hostname's lifecycle; see the SDK's `CustomDomainStatus`. */
export type CustomDomainStatus = SdkCustomDomainStatus;

/** A custom hostname bound to a sandbox, detached from the SDK's wire type. */
export interface CustomDomainInfo {
  hostname: string;
  status: CustomDomainStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  /** Container port traffic dials. Missing or `0` means the sandbox's toolbox port. */
  targetPort?: number;
}

/** A DNS record type the daemon emits for custom-domain wiring. */
export type DnsRecordType = SdkDNSRecordType;

/** One ready-to-paste DNS record for a custom domain. */
export interface DnsRecordInfo {
  hostname: string;
  type: DnsRecordType;
  /** The leftmost label, or `@` for an apex domain. */
  name: string;
  value: string;
  notes?: string;
}

/** Where the server derived the ingress address(es) from. */
export type IngressTargetSource = SdkIngressTargetSource;

/** The cluster's published ingress address(es) for custom-domain DNS. */
export interface IngressTargetInfo {
  hostname?: string;
  ips: string[];
  source: IngressTargetSource;
}

/** DNS records for a sandbox's custom-domain bindings and their ingress target. */
export interface CustomDomainDNSInfo {
  records: DnsRecordInfo[];
  target: IngressTargetInfo;
}

export interface AddCustomDomainInput {
  /** Container port to route to; omit for the sandbox's toolbox port. */
  port?: number;
}

/** Per-sandbox network byte counters and their configured caps. */
export interface NetworkUsageInfo {
  bytesIn: number;
  bytesOut: number;
  bytesInLimit: number;
  bytesOutLimit: number;
  quotaExceeded: boolean;
  quotaExceededAt?: string;
  /** Missing until the server has produced at least one sample. */
  lastSampledAt?: string;
}

/** Limits to set; omit a field to leave it unchanged, and use `0` for no limit. */
export interface SetNetworkLimitsInput {
  bytesInLimit?: number;
  bytesOutLimit?: number;
}

/** One record from a sandbox's audit log. */
export interface AuditEventInfo {
  time: string;
  /** `"egress"` for outbound connections and denials; secret kinds otherwise. */
  kind?: string;
  /** `"success"`, or `"failure"` for a denial. */
  result: string;
  reason?: string;
  destination?: string;
  network?: string;
  actor?: string;
  ref?: string;
  eventID?: string;
  incarnationID?: string;
  /** Records lost at this point (a gap record). */
  dropped?: number;
}

export interface AuditCoverageInfo {
  /** Nodes that answered the audit query. */
  answered: string[];
  /** Nodes that could not answer. */
  missing: string[];
  /** True when some nodes could not answer. */
  partial: boolean;
}

export interface AuditPageInfo {
  events: AuditEventInfo[];
  coverage: AuditCoverageInfo;
  /** Pass back as `cursor` for the next page. */
  nextCursor?: string;
}

export interface AuditQuery {
  /** Only this kind, e.g. `"egress"`. */
  kind?: string;
  limit?: number;
  cursor?: string;
  incarnationID?: string;
  caller?: string;
}

export interface CreatedSandbox {
  sandbox: SandboxInfo;
  /** Returned by the server only on create; save it immediately. */
  privateKey?: string;
}

/** A registered snapshot, detached from the SDK's wire type. */
export interface SnapshotInfo {
  name: string;
  image: string;
  imageID?: string;
  sourceSandboxID: string;
  createdAt: string;
  entrypoint?: string[];
  regionID?: string;
  cpu?: number;
  gpu?: number;
  memoryMB?: number;
  diskGB?: number;
}

export interface CreateSnapshotInput {
  /** Whether a running sandbox may pause briefly while its disk is copied. */
  allowPause?: boolean;
}

/** The caller's identity as the server reports it, without the raw wire type. */
export interface AccountInfo {
  role: string;
  team?: string;
  expiresAt?: string;
  /** `"token"`, `"operator"`, `"oidc"`, ... */
  principalKind?: string;
  /** For an API token, its public `tok_…` id, so the UI can spot revoking itself. */
  principalId?: string;
  principalName?: string;
}

export type ApiTokenRole = "viewer" | "runner" | "auditor" | "admin";

export const API_TOKEN_ROLES: readonly ApiTokenRole[] = ["viewer", "runner", "auditor", "admin"];

/** A scoped API token as listed. Never carries the secret. */
export interface ApiTokenInfo {
  id: string;
  name: string;
  role: string;
  /** A team name, or `"*"` for every team. */
  team: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface CreateApiTokenInput {
  name: string;
  role: ApiTokenRole;
  team: string;
  /** A Go duration such as `"90d"` or `"720h"`. */
  expiresIn: string;
}

/** A freshly created token. `secret` is shown this once; never store or log it. */
export interface CreatedApiToken {
  token: ApiTokenInfo;
  secret: string;
}

/** A team's quota limits and current server-side usage. */
export interface TeamQuotaInfo {
  team: string;
  maxSandboxes?: number;
  maxCPU?: number;
  maxMemoryMB?: number;
  usage?: {
    sandboxes: number;
    cpu: number;
    memoryMB: number;
  };
}

export interface RegisterSnapshotInput {
  name: string;
  /** A registry image reference. Mutually exclusive with `dockerfile`. */
  image?: string;
  /** Dockerfile contents. Mutually exclusive with `image`. */
  dockerfile?: string;
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
}

/** Snapshot names under this prefix belong to the server, not to callers. */
export const RESERVED_SNAPSHOT_PREFIX = "aerolvm-snapshot/";

/**
 * Trims and validates a snapshot name, returning the value to send to the
 * server. Empty names and the server's reserved prefix are rejected.
 */
export function validateSnapshotName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new Error("Snapshot name is required.");
  }
  if (name.startsWith(RESERVED_SNAPSHOT_PREFIX)) {
    throw new Error(`Snapshot names starting with "${RESERVED_SNAPSHOT_PREFIX}" are reserved.`);
  }
  return name;
}

function toSnapshotInfo(snapshot: SandboxSnapshot): SnapshotInfo {
  return {
    name: snapshot.name,
    image: snapshot.image,
    sourceSandboxID: snapshot.sourceSandboxID,
    createdAt: snapshot.createdAt,
    ...(snapshot.imageID === undefined ? {} : { imageID: snapshot.imageID }),
    ...(snapshot.entrypoint === undefined ? {} : { entrypoint: snapshot.entrypoint }),
    ...(snapshot.regionID === undefined ? {} : { regionID: snapshot.regionID }),
    ...(snapshot.cpu === undefined ? {} : { cpu: snapshot.cpu }),
    ...(snapshot.gpu === undefined ? {} : { gpu: snapshot.gpu }),
    ...(snapshot.memoryMB === undefined ? {} : { memoryMB: snapshot.memoryMB }),
    ...(snapshot.diskGB === undefined ? {} : { diskGB: snapshot.diskGB }),
  };
}

function tcpAddress(url: string): { host: string; hostPort: number } | null {
  if (!url.startsWith("tcp://")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const hostPort = Number(parsed.port);
    if (!host || !Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65535) {
      return null;
    }
    return { host, hostPort };
  } catch {
    return null;
  }
}

function toExposedPort(port: SdkExposedPort): ExposedPortInfo {
  const address = tcpAddress(port.publicURL);
  const protocol =
    port.protocol ?? (address ? "tcp" : /^https?:\/\//i.test(port.publicURL) ? "http" : undefined);
  return {
    port: port.port,
    url: port.publicURL,
    ...(port.visibility === "token" ? { visibility: "token" as const } : {}),
    ...(protocol === undefined ? {} : { protocol }),
    ...(address === null ? {} : { host: address.host, hostPort: address.hostPort }),
  };
}

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function durationToNanoseconds(ms: number): number {
  if (!Number.isFinite(ms) || !Number.isInteger(ms) || ms <= 0) {
    throw new Error(`Durations must be positive whole milliseconds (got ${ms}).`);
  }
  return ms * NANOSECONDS_PER_MILLISECOND;
}

function durationToMilliseconds(ns: number): number {
  return Math.round(ns / NANOSECONDS_PER_MILLISECOND);
}

function toSdkLifecycle(lifecycle: SandboxLifecycle): Lifecycle {
  const result: Lifecycle = {};
  if (lifecycle.stopIfIdleForMS !== undefined) {
    result.stopIfIdleFor = durationToNanoseconds(lifecycle.stopIfIdleForMS);
  }
  if (lifecycle.destroyIfIdleForMS !== undefined) {
    result.destroyIfIdleFor = durationToNanoseconds(lifecycle.destroyIfIdleForMS);
  }
  if (lifecycle.stopAtAgeMS !== undefined) {
    result.stopAtAge = durationToNanoseconds(lifecycle.stopAtAgeMS);
  }
  if (lifecycle.destroyAtAgeMS !== undefined) {
    result.destroyAtAge = durationToNanoseconds(lifecycle.destroyAtAgeMS);
  }
  if (lifecycle.destroyAfterExitForMS !== undefined) {
    result.destroyAfterExitFor = durationToNanoseconds(lifecycle.destroyAfterExitForMS);
  }
  if (lifecycle.serverless !== undefined) {
    result.serverless = lifecycle.serverless;
  }
  if (lifecycle.restartOnFailure !== undefined) {
    result.restartOnFailure = lifecycle.restartOnFailure;
  }
  return result;
}

function toLifecycle(lifecycle: Lifecycle): SandboxLifecycle {
  return {
    ...(lifecycle.stopIfIdleFor === undefined
      ? {}
      : { stopIfIdleForMS: durationToMilliseconds(lifecycle.stopIfIdleFor) }),
    ...(lifecycle.destroyIfIdleFor === undefined
      ? {}
      : { destroyIfIdleForMS: durationToMilliseconds(lifecycle.destroyIfIdleFor) }),
    ...(lifecycle.stopAtAge === undefined
      ? {}
      : { stopAtAgeMS: durationToMilliseconds(lifecycle.stopAtAge) }),
    ...(lifecycle.destroyAtAge === undefined
      ? {}
      : { destroyAtAgeMS: durationToMilliseconds(lifecycle.destroyAtAge) }),
    ...(lifecycle.destroyAfterExitFor === undefined
      ? {}
      : { destroyAfterExitForMS: durationToMilliseconds(lifecycle.destroyAfterExitFor) }),
    ...(lifecycle.serverless === undefined ? {} : { serverless: lifecycle.serverless }),
    ...(lifecycle.restartOnFailure === undefined
      ? {}
      : { restartOnFailure: lifecycle.restartOnFailure }),
  };
}

function toApiToken(token: APITokenList["tokens"][number]): ApiTokenInfo {
  return {
    id: token.id,
    name: token.name,
    role: token.role,
    team: token.team,
    createdBy: token.createdBy,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    expired: token.expired === true,
  };
}

const TOKEN_NAME = /^[A-Za-z0-9._-]{1,64}$/;
const GO_DURATION = /^(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h|d))+$/;

/** Checks a create request against the server's documented rules before sending it. */
export function validateCreateApiToken(input: CreateApiTokenInput): CreateAPITokenOptions {
  const name = input.name.trim();
  if (!TOKEN_NAME.test(name)) {
    throw new Error("Token names are 1-64 of A-Z, a-z, 0-9, dot, underscore or hyphen.");
  }
  if (!API_TOKEN_ROLES.includes(input.role)) {
    throw new Error("Role must be viewer, runner, auditor or admin.");
  }
  const team = input.team.trim();
  if (!team) {
    throw new Error('Enter a team name, or "*" for every team.');
  }
  if ((input.role === "auditor" || input.role === "admin") && team !== "*") {
    throw new Error(`The ${input.role} role needs team "*" (every team).`);
  }
  const expiresIn = input.expiresIn.trim();
  if (!GO_DURATION.test(expiresIn)) {
    throw new Error('Expiry must be a duration such as "90d", "720h" or "30m".');
  }
  return { name, role: input.role, team, expiresIn };
}

function toInfo(sandbox: SdkSandbox): SandboxInfo {
  const name = sandbox.name?.trim();
  return {
    id: sandbox.id,
    name: name && name.length > 0 ? name : undefined,
    image: sandbox.image,
    status: sandbox.status,
    cpu: sandbox.cpu,
    memoryMB: sandbox.memoryMB,
    diskGB: sandbox.diskGB,
    createdAt: sandbox.createdAt,
    publicURL: sandbox.publicURL,
    exposedPorts: (sandbox.exposedPorts ?? []).map(toExposedPort),
    lastError: sandbox.lastError,
    ...(sandbox.runtime === undefined ? {} : { runtime: sandbox.runtime }),
  };
}

function toTerminalSession(session: Session): TerminalSession {
  return {
    id: session.id,
    name: session.name,
    argv: [...session.argv],
    ...(session.workDir === undefined ? {} : { workDir: session.workDir }),
    pty: session.pty,
    status: session.status,
    exitCode: session.exitCode,
    ...(session.exitSignal === undefined ? {} : { exitSignal: session.exitSignal }),
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    ...(session.exitedAt === undefined ? {} : { exitedAt: session.exitedAt }),
    recording: session.recording,
    bytes: session.bytes,
    attached: session.attached,
  };
}

function toSdkCreateSessionOptions(input: CreateTerminalSessionInput): CreateSessionOptions {
  const options: CreateSessionOptions = {};
  if (input.name !== undefined) {
    options.name = input.name;
  }
  if (input.command !== undefined) {
    options.command = input.command;
  }
  if (input.argv !== undefined) {
    options.argv = [...input.argv];
  }
  if (input.workDir !== undefined) {
    options.workDir = input.workDir;
  }
  if (input.env !== undefined) {
    options.env = { ...input.env };
  }
  if (input.pty !== undefined) {
    options.pty = input.pty;
  }
  if (input.cols !== undefined) {
    options.cols = input.cols;
  }
  if (input.rows !== undefined) {
    options.rows = input.rows;
  }
  return options;
}

function toDetails(sandbox: SdkSandbox): SandboxDetails {
  return {
    ...toInfo(sandbox),
    osUser: sandbox.osUser,
    updatedAt: sandbox.updatedAt,
    lastActiveAt: sandbox.lastActiveAt,
    sshPublicKey: sandbox.sshPublicKey,
    ...(sandbox.statusReason === undefined ? {} : { statusReason: sandbox.statusReason }),
    ...(sandbox.exitCode === undefined ? {} : { exitCode: sandbox.exitCode }),
    lifecycle: toLifecycle(sandbox.lifecycle ?? {}),
    tags: { ...(sandbox.tags ?? {}) },
  };
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port must be an integer from 1 to 65535 (got ${port}).`);
  }
}

function toFileEntry(info: FileInfo): SandboxFileEntry {
  return {
    name: info.name,
    path: info.path,
    isDir: info.isDir,
    ...(info.symlinkTarget === undefined ? {} : { symlinkTarget: info.symlinkTarget }),
    ...(info.size === undefined ? {} : { size: info.size }),
    ...(info.modTime === undefined ? {} : { modTime: info.modTime }),
    ...(info.mode === undefined ? {} : { mode: info.mode }),
    ...(info.permissions === undefined ? {} : { permissions: info.permissions }),
    ...(info.owner === undefined ? {} : { owner: info.owner }),
    ...(info.group === undefined ? {} : { group: info.group }),
  };
}

function toFileMatch(match: FileMatch): SandboxFileMatch {
  return {
    file: match.file,
    line: match.line,
    content: match.content,
  };
}

function toCustomDomain(domain: CustomDomain): CustomDomainInfo {
  return {
    hostname: domain.hostname,
    status: domain.status,
    ...(domain.lastError === undefined ? {} : { lastError: domain.lastError }),
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    ...(domain.targetPort === undefined ? {} : { targetPort: domain.targetPort }),
  };
}

function toDnsRecord(record: DNSRecord): DnsRecordInfo {
  return {
    hostname: record.hostname,
    type: record.type,
    name: record.name,
    value: record.value,
    ...(record.notes === undefined ? {} : { notes: record.notes }),
  };
}

function toIngressTarget(target: IngressTarget): IngressTargetInfo {
  return {
    ...(target.hostname === undefined ? {} : { hostname: target.hostname }),
    ips: [...(target.ips ?? [])],
    source: target.source,
  };
}

function toCustomDomainDNS(records: CustomDomainDNSRecords): CustomDomainDNSInfo {
  return {
    records: records.records.map(toDnsRecord),
    target: toIngressTarget(records.target),
  };
}

function toNetworkUsage(usage: SdkNetworkUsage): NetworkUsageInfo {
  return {
    bytesIn: usage.bytesIn,
    bytesOut: usage.bytesOut,
    bytesInLimit: usage.bytesInLimit,
    bytesOutLimit: usage.bytesOutLimit,
    quotaExceeded: usage.quotaExceeded,
    ...(usage.quotaExceededAt === undefined ? {} : { quotaExceededAt: usage.quotaExceededAt }),
    ...(usage.lastSampledAt === undefined ? {} : { lastSampledAt: usage.lastSampledAt }),
  };
}

function toAuditEvent(event: AuditEvent): AuditEventInfo {
  return {
    time: event.time,
    ...(event.kind === undefined ? {} : { kind: event.kind }),
    result: event.result,
    ...(event.reason === undefined ? {} : { reason: event.reason }),
    ...(event.destination === undefined ? {} : { destination: event.destination }),
    ...(event.network === undefined ? {} : { network: event.network }),
    ...(event.actor === undefined ? {} : { actor: event.actor }),
    ...(event.ref === undefined ? {} : { ref: event.ref }),
    ...(event.eventID === undefined ? {} : { eventID: event.eventID }),
    ...(event.incarnationID === undefined ? {} : { incarnationID: event.incarnationID }),
    ...(event.dropped === undefined ? {} : { dropped: event.dropped }),
  };
}

function toAuditPage(page: AuditPage): AuditPageInfo {
  return {
    events: page.events.map(toAuditEvent),
    coverage: {
      answered: [...page.coverage.answered],
      missing: [...page.coverage.missing],
      partial: page.coverage.partial,
    },
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

function normalizeHostname(raw: string): string {
  const hostname = raw.trim();
  if (!hostname) {
    throw new Error("Hostname is required.");
  }
  return hostname;
}

function validateNetworkLimit(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number of bytes, or 0 for no limit (got ${value}).`);
  }
}

function toAuditOptions(query: AuditQuery): AuditOptions {
  const options: AuditOptions = {};
  if (query.kind !== undefined && query.kind !== "") {
    options.kind = query.kind;
  }
  if (query.limit !== undefined) {
    options.limit = query.limit;
  }
  if (query.cursor !== undefined && query.cursor !== "") {
    options.cursor = query.cursor;
  }
  if (query.incarnationID !== undefined && query.incarnationID !== "") {
    options.incarnationID = query.incarnationID;
  }
  if (query.caller !== undefined && query.caller !== "") {
    options.caller = query.caller;
  }
  return options;
}

function readRuntimeAvailability(
  health: Record<string, unknown>,
  runtime: ContainerRuntime,
): RuntimeAvailability {
  const value = health[runtime];
  if (typeof value !== "string") {
    return { state: "unknown" };
  }
  if (value === "ok") {
    return { state: "available" };
  }
  if (value === "disabled") {
    return { state: "off" };
  }
  return { state: "unhealthy", detail: value };
}

/**
 * Maps a raw `/health` body to the three runtimes the create form offers. The
 * SDK's `health()` drops these fields, so lewdev reads them itself.
 */
export function runtimeAvailabilityFromHealth(raw: unknown): RuntimeAvailabilityReport {
  const health =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : Object.create(null);
  return {
    docker: readRuntimeAvailability(health, "docker"),
    gvisor: readRuntimeAvailability(health, "gvisor"),
    firecracker: readRuntimeAvailability(health, "firecracker"),
  };
}

const HEALTH_TIMEOUT_MS = 5000;

/** Fetches `/health` (no version prefix) with the bearer auth the SDK sends. */
async function fetchHealthJson(apiUrl: string, token: string): Promise<unknown> {
  const response = await fetch(`${apiUrl}/health`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status}).`);
  }
  return response.json();
}

/**
 * A UI-free wrapper around the AerolVM SDK. Every network call goes through the
 * injected `AerolSdk`, which keeps the UI easy to test without a server.
 */
export class LewdevApi {
  constructor(
    private readonly sdk: AerolSdk,
    private readonly fetchHealth?: () => Promise<unknown>,
  ) {}

  static fromConfig(config: LewdevConfig): LewdevApi {
    const apiUrl = normalizeApiUrl(config.apiUrl);
    return new LewdevApi(
      new MicroVM({
        apiUrl,
        patToken: config.apiToken,
      }),
      () => fetchHealthJson(apiUrl, config.apiToken),
    );
  }

  async health(): Promise<HealthStatus> {
    return this.sdk.health();
  }

  /**
   * Which runtimes this server offers. A failed `/health` request reads as
   * unknown for every runtime, so the create form never blocks.
   */
  async getRuntimeAvailability(): Promise<RuntimeAvailabilityReport> {
    if (this.fetchHealth === undefined) {
      return runtimeAvailabilityFromHealth(undefined);
    }
    try {
      return runtimeAvailabilityFromHealth(await this.fetchHealth());
    } catch {
      return runtimeAvailabilityFromHealth(undefined);
    }
  }

  async listSandboxes(): Promise<SandboxInfo[]> {
    const sandboxes = await this.sdk.list();
    return sandboxes.map(toInfo);
  }

  async getSandbox(id: string): Promise<SandboxDetails> {
    return toDetails(await this.sdk.get(id));
  }

  async createSandbox(input: CreateSandboxInput): Promise<CreatedSandbox> {
    const image = input.image?.trim() ?? "";
    const dockerfile = input.dockerfile?.trim() ?? "";
    if (image && dockerfile) {
      throw new Error("Provide either an image or a Dockerfile, not both.");
    }
    if (!image && !dockerfile) {
      throw new Error("An image or Dockerfile is required.");
    }

    const options: CreateOptions = {
      image: dockerfile ? Image.fromDockerfile(dockerfile) : image,
    };
    const name = input.name?.trim();
    if (name) {
      options.name = name;
    }
    if (input.cpu !== undefined) {
      options.cpu = input.cpu;
    }
    if (input.memoryMB !== undefined) {
      options.memoryMB = input.memoryMB;
    }
    if (input.diskGB !== undefined) {
      options.diskGB = input.diskGB;
    }
    if (input.lifecycle !== undefined) {
      options.lifecycle = toSdkLifecycle(input.lifecycle);
    }
    if (input.runtime !== undefined) {
      options.runtime = input.runtime;
    }

    const sandbox = await this.sdk.create(options);
    const privateKey = sandbox.sshPrivateKey?.trim() ? sandbox.sshPrivateKey : undefined;
    return { sandbox: toInfo(sandbox), privateKey };
  }

  async startSandbox(id: string): Promise<SandboxInfo> {
    return toInfo(await this.sdk.start(id));
  }

  async stopSandbox(id: string): Promise<SandboxInfo> {
    return toInfo(await this.sdk.stop(id));
  }

  /** The SDK has no restart call; lewdev models it as a stop followed by a start. */
  async restartSandbox(id: string): Promise<SandboxInfo> {
    await this.sdk.stop(id);
    return toInfo(await this.sdk.start(id));
  }

  async destroySandbox(id: string): Promise<void> {
    await this.sdk.destroy(id);
  }

  /** Changes CPU, memory or disk. Omitted dimensions keep their current value. */
  async resize(id: string, input: ResizeSandboxInput): Promise<SandboxDetails> {
    const options: ResizeOptions = {};
    if (input.cpu !== undefined) {
      options.cpu = input.cpu;
    }
    if (input.memoryMB !== undefined) {
      options.memoryMB = input.memoryMB;
    }
    if (input.diskGB !== undefined) {
      options.diskGB = input.diskGB;
    }
    return toDetails(await this.sdk.resize(id, options));
  }

  /** Replaces every lifecycle timer; fields left out are turned off. */
  async updateLifecycle(id: string, lifecycle: SandboxLifecycle): Promise<SandboxDetails> {
    return toDetails(await this.sdk.updateLifecycle(id, toSdkLifecycle(lifecycle)));
  }

  async openPort(
    id: string,
    port: number,
    visibility: PortVisibility = "public",
  ): Promise<ExposedPortInfo> {
    validatePort(port);
    const sandbox = await this.sdk.get(id);
    const result = await sandbox.exposePort(port, { visibility });
    return {
      port,
      url: result.url,
      visibility,
      protocol: result.protocol,
    };
  }

  async closePort(id: string, port: number): Promise<void> {
    validatePort(port);
    const sandbox = await this.sdk.get(id);
    await sandbox.unexposePort(port);
  }

  /** Exposes a container port as raw TCP and returns the host address clients dial. */
  async openTcpPort(id: string, port: number): Promise<ExposedPortInfo> {
    validatePort(port);
    const sandbox = await this.sdk.get(id);
    const result = await sandbox.exposePort(port, { protocol: "tcp" });
    if (result.protocol !== "tcp") {
      throw new Error(`The server exposed port ${port} as ${result.protocol}, not TCP.`);
    }
    return {
      port,
      url: result.url,
      protocol: "tcp",
      host: result.host,
      hostPort: result.hostPort,
    };
  }

  /** Runs a command inside the sandbox and returns its captured output. */
  async exec(
    id: string,
    command: string,
    options: { timeoutSeconds?: number } = {},
  ): Promise<SandboxExecResult> {
    const sandbox = await this.sdk.get(id);
    const result = await sandbox.exec({
      command,
      ...(options.timeoutSeconds === undefined ? {} : { timeoutSeconds: options.timeoutSeconds }),
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    };
  }

  /** Opens a non-PTY command stream, used by the ssh-proxy CLI. */
  async execStream(
    id: string,
    options: SandboxExecStreamOptions,
  ): Promise<SandboxExecStreamHandle> {
    const sandbox = await this.sdk.get(id);
    const handle = sandbox.execStream({
      command: options.command,
      tty: false,
      ...(options.onStdout === undefined ? {} : { onStdout: options.onStdout }),
      ...(options.onStderr === undefined ? {} : { onStderr: options.onStderr }),
      ...(options.onError === undefined ? {} : { onError: options.onError }),
    });
    return {
      write: (data) => handle.write(data),
      close: () => handle.close(),
      signal: (name) => handle.signal(name),
      done: handle.done.then((info: { code: number; signal?: string }) => ({
        code: info.code,
        ...(info.signal === undefined ? {} : { signal: info.signal }),
      })),
    };
  }

  async createSession(
    id: string,
    input: CreateTerminalSessionInput = {},
  ): Promise<TerminalSession> {
    return toTerminalSession(await this.sdk.createSession(id, toSdkCreateSessionOptions(input)));
  }

  async listSessions(id: string): Promise<TerminalSession[]> {
    const sessions = await this.sdk.listSessions(id);
    return sessions.map(toTerminalSession);
  }

  async getSession(id: string, sessionID: string): Promise<TerminalSession> {
    return toTerminalSession(await this.sdk.getSession(id, sessionID));
  }

  /** Stops the session's program at once and removes the session. */
  async deleteSession(id: string, sessionID: string): Promise<void> {
    await this.sdk.deleteSession(id, sessionID);
  }

  async signalSession(id: string, sessionID: string, signal: string): Promise<void> {
    await this.sdk.signalSession(id, sessionID, signal);
  }

  async resizeSession(id: string, sessionID: string, cols: number, rows: number): Promise<void> {
    await this.sdk.resizeSession(id, sessionID, cols, rows);
  }

  /** The session's recent output, up to the server's 1 MB log. */
  async sessionLog(id: string, sessionID: string): Promise<Uint8Array> {
    return this.sdk.sessionLog(id, sessionID);
  }

  /** Attaches and returns a handle that can detach without killing the session. */
  attachSession(
    id: string,
    sessionID: string,
    options: TerminalSessionAttachOptions = {},
  ): TerminalSessionAttachHandle {
    const handle = this.sdk.attachSession(id, sessionID, {
      ...(options.onStdout === undefined ? {} : { onStdout: options.onStdout }),
      ...(options.onStderr === undefined ? {} : { onStderr: options.onStderr }),
      ...(options.onExit === undefined ? {} : { onExit: options.onExit }),
      ...(options.onError === undefined ? {} : { onError: options.onError }),
      ...(options.cols === undefined ? {} : { cols: options.cols }),
      ...(options.rows === undefined ? {} : { rows: options.rows }),
    });
    return {
      write: (data) => handle.write(data),
      resize: (cols, rows) => handle.resize(cols, rows),
      signal: (name) => handle.signal(name),
      close: () => handle.close(),
      done: handle.done.then((info: { code: number; signal?: string }) => ({
        code: info.code,
        ...(info.signal === undefined ? {} : { signal: info.signal }),
      })),
    };
  }

  async listFiles(
    id: string,
    path: string,
    options: ListFilesOptions = {},
  ): Promise<SandboxFileList> {
    const sandbox = await this.sdk.get(id);
    const result = await sandbox.listFiles(path, options);
    return {
      entries: result.entries.map(toFileEntry),
      truncated: result.truncated,
    };
  }

  async getFileInfo(id: string, path: string): Promise<SandboxFileInfo> {
    const sandbox = await this.sdk.get(id);
    return toFileEntry(await sandbox.getFileInfo(path));
  }

  async fileExists(id: string, path: string): Promise<boolean> {
    const sandbox = await this.sdk.get(id);
    return sandbox.fileExists(path);
  }

  /** Uploads text or bytes to a path inside the sandbox. */
  async uploadFile(
    id: string,
    targetPath: string,
    data: string | Uint8Array,
    options: SandboxUploadOptions = {},
  ): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.uploadFile(targetPath, data, options);
  }

  /** Uploads from a stream so a large local file never sits in memory. */
  async uploadFileStream(
    id: string,
    targetPath: string,
    data: SandboxUploadData,
    options: SandboxUploadOptions = {},
  ): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.uploadFileStream(targetPath, data, options);
  }

  /** Copies a local folder into a sandbox folder, which is made if missing. */
  async uploadDir(id: string, localDir: string, remoteDir: string): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.uploadDir(localDir, remoteDir);
  }

  async downloadFile(
    id: string,
    path: string,
    options: SandboxDownloadOptions = {},
  ): Promise<Uint8Array> {
    const sandbox = await this.sdk.get(id);
    return sandbox.downloadFile(path, options);
  }

  /** Reads a sandbox file a piece at a time. */
  async downloadFileStream(
    id: string,
    path: string,
    options: SandboxDownloadOptions = {},
  ): Promise<ReadableStream<Uint8Array>> {
    const sandbox = await this.sdk.get(id);
    return sandbox.downloadFileStream(path, options);
  }

  async deleteFile(id: string, path: string, options: SandboxDeleteOptions = {}): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.deleteFile(path, options);
  }

  async makeDir(id: string, path: string, options: SandboxMakeDirOptions = {}): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.makeDir(path, options);
  }

  async moveFile(
    id: string,
    source: string,
    destination: string,
    options: SandboxMoveOptions = {},
  ): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.moveFile(source, destination, options);
  }

  async copyFile(
    id: string,
    source: string,
    destination: string,
    options: SandboxCopyOptions = {},
  ): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.copyFile(source, destination, options);
  }

  /** Finds paths under a folder whose name matches a pattern. */
  async searchFiles(id: string, path: string, pattern: string): Promise<string[]> {
    const sandbox = await this.sdk.get(id);
    return sandbox.searchFiles(path, pattern);
  }

  /** Finds lines inside files under a folder that contain some text. */
  async findInFiles(id: string, path: string, text: string): Promise<SandboxFileMatch[]> {
    const sandbox = await this.sdk.get(id);
    return (await sandbox.findInFiles(path, text)).map(toFileMatch);
  }

  async listCustomDomains(id: string): Promise<CustomDomainInfo[]> {
    const sandbox = await this.sdk.get(id);
    return (await sandbox.customDomains.list()).map(toCustomDomain);
  }

  /** Binds a hostname; the server lowercases it and returns the full binding list. */
  async addCustomDomain(
    id: string,
    hostname: string,
    input: AddCustomDomainInput = {},
  ): Promise<CustomDomainInfo[]> {
    const normalized = normalizeHostname(hostname);
    if (input.port !== undefined) {
      validatePort(input.port);
    }
    const sandbox = await this.sdk.get(id);
    const domains =
      input.port === undefined
        ? await sandbox.customDomains.add(normalized)
        : await sandbox.customDomains.add(normalized, { port: input.port });
    return domains.map(toCustomDomain);
  }

  async removeCustomDomain(id: string, hostname: string): Promise<void> {
    const normalized = normalizeHostname(hostname);
    const sandbox = await this.sdk.get(id);
    await sandbox.customDomains.remove(normalized);
  }

  /** The ready-to-paste DNS records for every custom domain bound to the sandbox. */
  async customDomainDNS(id: string): Promise<CustomDomainDNSInfo> {
    const sandbox = await this.sdk.get(id);
    return toCustomDomainDNS(await sandbox.customDomains.dns());
  }

  /** The cluster's published ingress address(es) for custom-domain DNS. */
  async getIngressTarget(): Promise<IngressTargetInfo> {
    return toIngressTarget(await this.sdk.dns.target());
  }

  async getNetworkUsage(id: string): Promise<NetworkUsageInfo> {
    const sandbox = await this.sdk.get(id);
    return toNetworkUsage(await sandbox.getNetworkUsage());
  }

  /** Sets byte caps; `0` means no limit and an omitted field is left unchanged. */
  async setNetworkLimits(id: string, input: SetNetworkLimitsInput): Promise<NetworkUsageInfo> {
    const options: SdkSetNetworkLimitsOptions = {};
    if (input.bytesInLimit !== undefined) {
      validateNetworkLimit("Inbound limit", input.bytesInLimit);
      options.networkBytesInLimit = input.bytesInLimit;
    }
    if (input.bytesOutLimit !== undefined) {
      validateNetworkLimit("Outbound limit", input.bytesOutLimit);
      options.networkBytesOutLimit = input.bytesOutLimit;
    }
    const sandbox = await this.sdk.get(id);
    return toNetworkUsage(await sandbox.setNetworkLimits(options));
  }

  /** Reads one page of the sandbox's audit log; pass `cursor` for the next page. */
  async getAuditLog(id: string, query: AuditQuery = {}): Promise<AuditPageInfo> {
    const sandbox = await this.sdk.get(id);
    return toAuditPage(await sandbox.audit(toAuditOptions(query)));
  }

  /** Loads every page of the caller's snapshots, following the name cursor. */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    const snapshots: SnapshotInfo[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await this.sdk.listSnapshots(
        startingAfter === undefined ? undefined : { startingAfter },
      );
      snapshots.push(...page.snapshots.map(toSnapshotInfo));
      const last = page.snapshots[page.snapshots.length - 1];
      if (!page.hasMore || last === undefined) {
        break;
      }
      startingAfter = last.name;
    }
    return snapshots;
  }

  async getSnapshot(name: string): Promise<SnapshotInfo> {
    return toSnapshotInfo(await this.sdk.getSnapshot(validateSnapshotName(name)));
  }

  async createSnapshot(
    id: string,
    name: string,
    input: CreateSnapshotInput = {},
  ): Promise<SnapshotInfo> {
    const normalized = validateSnapshotName(name);
    const options: CreateSnapshotOptions | undefined =
      input.allowPause === undefined ? undefined : { allowPause: input.allowPause };
    return toSnapshotInfo(await this.sdk.createSnapshot(id, normalized, options));
  }

  async registerSnapshot(input: RegisterSnapshotInput): Promise<SnapshotInfo> {
    const name = validateSnapshotName(input.name);
    const image = input.image?.trim() ?? "";
    const dockerfile = input.dockerfile?.trim() ?? "";
    if (image && dockerfile) {
      throw new Error("Provide either an image or a Dockerfile, not both.");
    }
    if (!image && !dockerfile) {
      throw new Error("An image or Dockerfile is required.");
    }

    const options: RegisterSnapshotOptions = {
      name,
      ...(dockerfile ? { dockerfileContent: dockerfile } : { image }),
    };
    if (input.cpu !== undefined) {
      options.cpu = input.cpu;
    }
    if (input.memoryMB !== undefined) {
      options.memoryMB = input.memoryMB;
    }
    if (input.diskGB !== undefined) {
      options.diskGB = input.diskGB;
    }
    return toSnapshotInfo(await this.sdk.registerSnapshot(options));
  }

  async deleteSnapshot(name: string): Promise<void> {
    await this.sdk.deleteSnapshot(validateSnapshotName(name));
  }

  async whoami(): Promise<AccountInfo> {
    const who = await this.sdk.whoami();
    return {
      role: who.role,
      ...(who.team === undefined ? {} : { team: who.team }),
      ...(who.expiresAt === undefined ? {} : { expiresAt: who.expiresAt }),
      ...(who.principal?.kind === undefined ? {} : { principalKind: who.principal.kind }),
      ...(who.principal?.id === undefined ? {} : { principalId: who.principal.id }),
      ...(who.principal?.name === undefined ? {} : { principalName: who.principal.name }),
    };
  }

  /** Every API token, newest first (auditor or admin). Expired ones stay for 30 days. */
  async listApiTokens(): Promise<ApiTokenInfo[]> {
    const list = await this.sdk.tokens.list();
    return (list.tokens ?? [])
      .map(toApiToken)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  /**
   * Mints a token (admin only). The secret comes back this once: the caller
   * must show it and drop it, never persist or log it.
   */
  async createApiToken(input: CreateApiTokenInput): Promise<CreatedApiToken> {
    const options = validateCreateApiToken(input);
    const created = await this.sdk.tokens.create(options);
    return { token: toApiToken(created), secret: created.token };
  }

  /** Revokes a token by its `tok_…` id (admin only). Revoking one already gone succeeds. */
  async revokeApiToken(id: string): Promise<void> {
    const trimmed = id.trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(trimmed)) {
      throw new Error("That is not a valid token id.");
    }
    await this.sdk.tokens.revoke(trimmed);
  }

  async getTeamQuota(team: string): Promise<TeamQuotaInfo> {
    const quota = await this.sdk.getTeamQuota(team);
    return {
      team: quota.team,
      ...(quota.maxSandboxes === undefined ? {} : { maxSandboxes: quota.maxSandboxes }),
      ...(quota.maxCPU === undefined ? {} : { maxCPU: quota.maxCPU }),
      ...(quota.maxMemoryMB === undefined ? {} : { maxMemoryMB: quota.maxMemoryMB }),
      ...(quota.usage === undefined ? {} : { usage: quota.usage }),
    };
  }
}
