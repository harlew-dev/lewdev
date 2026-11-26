import {
  type CallOptions,
  type CreateOptions,
  type CreateSnapshotOptions,
  type ExposePortOptions,
  type ExposeResult,
  type ExposeVisibility,
  type GetOptions,
  type HealthStatus,
  Image,
  type ListOptions,
  type ListSnapshotsOptions,
  MicroVM,
  type RegisterSnapshotOptions,
  type SandboxSnapshot,
  type SandboxStatus,
  type SnapshotList,
  type TeamQuota,
  type WhoAmI,
} from "@aerol-ai/aerolvm-sdk";

import type { LewdevConfig } from "./config.js";
import { normalizeApiUrl } from "./config.js";

export interface SdkExposedPort {
  port: number;
  publicURL: string;
  visibility?: ExposeVisibility;
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
  exposePort(port: number, options?: ExposePortOptions, call?: CallOptions): Promise<ExposeResult>;
  unexposePort(port: number, call?: CallOptions): Promise<void>;
}

/** The subset of `MicroVM` that lewdev depends on. Tests inject a fake. */
export interface AerolSdk {
  create(options: CreateOptions, call?: CallOptions): Promise<SdkSandbox>;
  list(options?: ListOptions, call?: CallOptions): Promise<SdkSandbox[]>;
  get(id: string, options?: GetOptions, call?: CallOptions): Promise<SdkSandbox>;
  start(id: string, call?: CallOptions): Promise<SdkSandbox>;
  stop(id: string, call?: CallOptions): Promise<SdkSandbox>;
  destroy(id: string, call?: CallOptions): Promise<void>;
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
}

export interface SandboxDetails extends SandboxInfo {
  osUser: string;
  updatedAt: string;
  lastActiveAt: string;
  sshPublicKey?: string;
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

function toExposedPort(port: SdkExposedPort): ExposedPortInfo {
  return {
    port: port.port,
    url: port.publicURL,
    visibility: port.visibility === "token" ? "token" : undefined,
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
  };
}

function toDetails(sandbox: SdkSandbox): SandboxDetails {
  return {
    ...toInfo(sandbox),
    osUser: sandbox.osUser,
    updatedAt: sandbox.updatedAt,
    lastActiveAt: sandbox.lastActiveAt,
    sshPublicKey: sandbox.sshPublicKey,
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
