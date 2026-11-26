import {
  type BinaryLike,
  type CallOptions,
  type CreateOptions,
  type CreateSnapshotOptions,
  type ExecRequest,
  type ExecResult,
  type ExposePortOptions,
  type FileInfo,
  type FileList,
  type ListFilesOptions,
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
  type SnapshotList,
  type TeamQuota,
  type UploadFileOptions,
  type WhoAmI,
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

/** A sandbox execution runtime; WASM and isolate sandboxes have no shell. */
export type SandboxRuntime = "docker" | "gvisor" | "kata" | "firecracker" | "wasm" | "isolate";

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
  uploadFile(
    targetPath: string,
    data: BinaryLike,
    options?: UploadFileOptions,
    call?: CallOptions,
  ): Promise<void>;
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
}

export interface SandboxFileList {
  entries: SandboxFileEntry[];
  truncated: boolean;
}

export interface SandboxFileInfo extends SandboxFileEntry {}

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

/**
 * A UI-free wrapper around the AerolVM SDK. Every network call goes through the
 * injected `AerolSdk`, which keeps the UI easy to test without a server.
 */
export class LewdevApi {
  constructor(private readonly sdk: AerolSdk) {}

  static fromConfig(config: LewdevConfig): LewdevApi {
    return new LewdevApi(
      new MicroVM({
        apiUrl: normalizeApiUrl(config.apiUrl),
        patToken: config.apiToken,
      }),
    );
  }

  async health(): Promise<HealthStatus> {
    return this.sdk.health();
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

  async listFiles(
    id: string,
    path: string,
    options: ListFilesOptions = {},
  ): Promise<SandboxFileList> {
    const sandbox = await this.sdk.get(id);
    const result = await sandbox.listFiles(path, options);
    return {
      entries: result.entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDir: entry.isDir,
        ...(entry.symlinkTarget === undefined ? {} : { symlinkTarget: entry.symlinkTarget }),
      })),
      truncated: result.truncated,
    };
  }

  async getFileInfo(id: string, path: string): Promise<SandboxFileInfo> {
    const sandbox = await this.sdk.get(id);
    const info = await sandbox.getFileInfo(path);
    return {
      name: info.name,
      path: info.path,
      isDir: info.isDir,
      ...(info.symlinkTarget === undefined ? {} : { symlinkTarget: info.symlinkTarget }),
    };
  }

  /** Uploads text to a path inside the sandbox. */
  async uploadFile(
    id: string,
    targetPath: string,
    data: string | Uint8Array,
    options: UploadFileOptions = {},
  ): Promise<void> {
    const sandbox = await this.sdk.get(id);
    await sandbox.uploadFile(targetPath, data, options);
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
    };
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
