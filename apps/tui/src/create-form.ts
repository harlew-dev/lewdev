import type {
  ContainerRuntime,
  RuntimeAvailabilityReport,
  SandboxLifecycle,
  SnapshotInfo,
} from "@lewdev/core";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { formatAge } from "./format";

export type ImageSource = "preset" | "snapshot" | "custom" | "dockerfile";
export type DockerfileMode = "file" | "paste";
export type SizeId = "small" | "default" | "large" | "xlarge" | "custom";
export type StopIdleId = "off" | "15m" | "30m" | "1h" | "2h" | "4h";
export type RuntimeChoice = "default" | ContainerRuntime;
export type CreateFocus =
  | "image"
  | "image-ref"
  | "image-dockerfile-mode"
  | "image-dockerfile"
  | "image-snapshot"
  | "size"
  | "size-cpu"
  | "size-memory"
  | "size-disk"
  | "runtime"
  | "stop-idle"
  | "name"
  | "submit";

export interface SizeFormValues {
  size: SizeId;
  customCpu: string;
  customMemoryGB: string;
  customDiskGB: string;
}

export interface CreateFormValues extends SizeFormValues {
  imageSource: ImageSource;
  image: string;
  snapshotName: string;
  customImage: string;
  dockerfileMode: DockerfileMode;
  dockerfilePath: string;
  dockerfileContents: string;
  runtime: RuntimeChoice;
  stopIdle: StopIdleId;
  name: string;
}

export const CREATE_DEFAULT: CreateFormValues = {
  imageSource: "preset",
  image: "ubuntu:24.04",
  snapshotName: "",
  customImage: "",
  dockerfileMode: "file",
  dockerfilePath: "",
  dockerfileContents: "",
  size: "default",
  customCpu: "",
  customMemoryGB: "",
  customDiskGB: "",
  runtime: "default",
  stopIdle: "off",
  name: "",
};

const MINUTE_MS = 60 * 1000;

export const STOP_IDLE_CHOICES: Array<{ id: StopIdleId; label: string; ms?: number }> = [
  { id: "off", label: "Off" },
  { id: "15m", label: "15m", ms: 15 * MINUTE_MS },
  { id: "30m", label: "30m", ms: 30 * MINUTE_MS },
  { id: "1h", label: "1h", ms: 60 * MINUTE_MS },
  { id: "2h", label: "2h", ms: 120 * MINUTE_MS },
  { id: "4h", label: "4h", ms: 240 * MINUTE_MS },
];

/** Create-time lifecycle, or undefined when the sandbox should have no timers. */
export function createLifecycleInput(values: CreateFormValues): SandboxLifecycle | undefined {
  const choice = STOP_IDLE_CHOICES.find((entry) => entry.id === values.stopIdle);
  return choice?.ms === undefined ? undefined : { stopIfIdleForMS: choice.ms };
}

export function toggleStopIdle(current: StopIdleId, delta: number): StopIdleId {
  const index = STOP_IDLE_CHOICES.findIndex((choice) => choice.id === current);
  const base = Math.max(index, 0);
  const next = (base + delta + STOP_IDLE_CHOICES.length) % STOP_IDLE_CHOICES.length;
  return STOP_IDLE_CHOICES[next]?.id ?? "off";
}

export const RUNTIME_CHOICES: Array<{
  id: RuntimeChoice;
  label: string;
  runtime?: ContainerRuntime;
}> = [
  { id: "default", label: "Default" },
  { id: "docker", label: "Docker", runtime: "docker" },
  { id: "gvisor", label: "gVisor", runtime: "gvisor" },
  { id: "firecracker", label: "Firecracker", runtime: "firecracker" },
];

export const RUNTIME_LABELS: Record<ContainerRuntime, string> = {
  docker: "Docker",
  gvisor: "gVisor",
  firecracker: "Firecracker",
};

/** Shown until the health request answers; also the fallback when it fails. */
export const UNKNOWN_RUNTIME_REPORT: RuntimeAvailabilityReport = {
  docker: { state: "unknown" },
  gvisor: { state: "unknown" },
  firecracker: { state: "unknown" },
};

const RUNTIME_HINTS: Record<RuntimeChoice, string> = {
  default: "Uses the server's default runtime (Docker unless the operator changed it).",
  docker: "The standard container runtime.",
  gvisor: "Ignores per-sandbox disk quotas and cannot use GPUs.",
  firecracker: "First boot takes 10–60 seconds.",
};

export interface RuntimeOption {
  id: RuntimeChoice;
  label: string;
  disabled?: boolean;
}

/** Segmented-row options, muting runtimes the server reports off or unhealthy. */
export function runtimeRowOptions(report: RuntimeAvailabilityReport): RuntimeOption[] {
  return RUNTIME_CHOICES.map((choice) => {
    if (choice.runtime === undefined) {
      return { id: choice.id, label: choice.label };
    }
    const state = report[choice.runtime].state;
    return {
      id: choice.id,
      label: choice.label,
      ...(state === "off" || state === "unhealthy" ? { disabled: true } : {}),
    };
  });
}

/** Moves through the enabled runtimes, wrapping and skipping muted ones. */
export function moveRuntimeChoice(
  current: RuntimeChoice,
  delta: number,
  report: RuntimeAvailabilityReport,
): RuntimeChoice {
  const options = runtimeRowOptions(report);
  let index = Math.max(
    options.findIndex((option) => option.id === current),
    0,
  );
  for (let step = 0; step < options.length; step += 1) {
    index = (index + delta + options.length) % options.length;
    const option = options[index];
    if (option && !option.disabled) {
      return option.id;
    }
  }
  return "default";
}

/** The runtime to send, or undefined to leave the server's default alone. */
export function createRuntimeInput(values: {
  runtime: RuntimeChoice;
}): ContainerRuntime | undefined {
  return values.runtime === "default" ? undefined : values.runtime;
}

export function runtimeHint(choice: RuntimeChoice): string {
  return RUNTIME_HINTS[choice];
}

/** Why a runtime the server did not report is still selectable, or null. */
export function runtimeUnknownNote(
  choice: RuntimeChoice,
  report: RuntimeAvailabilityReport,
): string | null {
  if (choice === "default" || report[choice].state !== "unknown") {
    return null;
  }
  return `This server doesn't report ${RUNTIME_LABELS[choice]}; the create fails if it isn't enabled.`;
}

/** One muted line listing the runtimes the server reports as unavailable. */
export function runtimeUnavailableSummary(report: RuntimeAvailabilityReport): string | null {
  const parts = RUNTIME_CHOICES.flatMap((choice) => {
    if (choice.runtime === undefined) {
      return [];
    }
    const status = report[choice.runtime];
    if (status.state === "off") {
      return [`${choice.label}: disabled`];
    }
    if (status.state === "unhealthy") {
      return [`${choice.label}: ${status.detail ?? "unhealthy"}`];
    }
    return [];
  });
  return parts.length === 0 ? null : parts.join(" · ");
}

export interface SizePreset {
  id: Exclude<SizeId, "custom">;
  label: string;
  cpu: number;
  memoryMB: number;
  diskGB: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "small", label: "small", cpu: 2, memoryMB: 4096, diskGB: 20 },
  { id: "default", label: "default", cpu: 4, memoryMB: 8192, diskGB: 40 },
  { id: "large", label: "large", cpu: 8, memoryMB: 16384, diskGB: 80 },
  { id: "xlarge", label: "xlarge", cpu: 16, memoryMB: 32768, diskGB: 160 },
];

export const SIZE_CHOICES: Array<{ id: SizeId; label: string }> = [
  ...SIZE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
  { id: "custom", label: "custom" },
];

export const IMAGE_PRESETS = [
  "ubuntu:24.04",
  "ubuntu:22.04",
  "debian:12",
  "alpine:3.22",
  "node:22",
  "python:3.13",
  "golang:1.25",
] as const;

export const CREATE_NAME_FIELD = {
  key: "name",
  label: "Name",
  placeholder: "optional, unique",
} as const;

export interface ImageOption {
  id: string;
  label: string;
  kind: "preset" | "snapshot" | "custom" | "dockerfile";
  /** Muted trailing text, such as a snapshot's image and age. */
  detail?: string;
  disabled?: boolean;
  snapshotName?: string;
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
}

const SNAPSHOT_OPTION_PREFIX = "snapshot:";
const SNAPSHOT_SOURCE_OPTION_ID = "snapshot";

export function snapshotOptionId(name: string): string {
  return `${SNAPSHOT_OPTION_PREFIX}${name}`;
}

export function snapshotImageOption(snapshot: SnapshotInfo): ImageOption {
  return {
    id: snapshotOptionId(snapshot.name),
    label: snapshot.name,
    kind: "snapshot",
    snapshotName: snapshot.name,
    detail: `${snapshot.image} · ${formatAge(snapshot.createdAt)}`,
    ...(snapshot.cpu === undefined ? {} : { cpu: snapshot.cpu }),
    ...(snapshot.memoryMB === undefined ? {} : { memoryMB: snapshot.memoryMB }),
    ...(snapshot.diskGB === undefined ? {} : { diskGB: snapshot.diskGB }),
  };
}

const PRESET_OPTIONS: ImageOption[] = IMAGE_PRESETS.map((image) => ({
  id: image,
  label: image,
  kind: "preset",
}));

const CUSTOM_IMAGE_OPTION: ImageOption = {
  id: "custom-image",
  label: "Custom image…",
  kind: "custom",
};

const DOCKERFILE_OPTION: ImageOption = {
  id: "dockerfile",
  label: "Dockerfile…",
  kind: "dockerfile",
};

const SNAPSHOT_SOURCE_OPTION: ImageOption = {
  id: SNAPSHOT_SOURCE_OPTION_ID,
  label: "Snapshot…",
  kind: "snapshot",
};

/** The Image dropdown: Dockerfile, Custom image, Snapshot, then presets. */
export const IMAGE_MENU_OPTIONS: ImageOption[] = [
  DOCKERFILE_OPTION,
  CUSTOM_IMAGE_OPTION,
  SNAPSHOT_SOURCE_OPTION,
  ...PRESET_OPTIONS,
];

/** The Snapshot row's dropdown: loaded snapshots, or a disabled status row. */
export function buildSnapshotMenuOptions(
  snapshots: SnapshotInfo[],
  snapshotsLoaded: boolean,
): ImageOption[] {
  if (!snapshotsLoaded) {
    return [
      {
        id: "snapshots-loading",
        label: "Loading snapshots…",
        kind: "snapshot",
        disabled: true,
      },
    ];
  }
  if (snapshots.length === 0) {
    return [
      {
        id: "snapshots-empty",
        label: "No snapshots",
        kind: "snapshot",
        disabled: true,
      },
    ];
  }
  return snapshots.map(snapshotImageOption);
}

export function menuOptionAt(options: ImageOption[], index: number): ImageOption | undefined {
  return options[index];
}

/** Moves to the next selectable option, skipping disabled rows. */
export function nextMenuIndex(options: ImageOption[], current: number, delta: number): number {
  if (options.length === 0) {
    return 0;
  }
  let index = Math.min(Math.max(current, 0), options.length - 1);
  for (let step = 0; step < options.length; step += 1) {
    index = (index + delta + options.length) % options.length;
    const option = options[index];
    if (option && !option.disabled) {
      return index;
    }
  }
  return Math.min(Math.max(current, 0), options.length - 1);
}

export function sizePreset(id: SizeId): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => preset.id === id);
}

/** Moves through the size cards, wrapping at the ends. */
export function moveSize(id: SizeId, delta: number): SizeId {
  const index = SIZE_CHOICES.findIndex((choice) => choice.id === id);
  const current = Math.max(index, 0);
  const next = (current + delta + SIZE_CHOICES.length) % SIZE_CHOICES.length;
  return SIZE_CHOICES[next]?.id ?? "default";
}

export function createSizeSummary(values: SizeFormValues): string {
  const preset = sizePreset(values.size);
  if (preset) {
    return `${preset.cpu} vCPU · ${preset.memoryMB / 1024} GB memory · ${preset.diskGB} GB disk`;
  }
  const cpu = values.customCpu.trim() || "—";
  const memory = values.customMemoryGB.trim() || "—";
  const disk = values.customDiskGB.trim() || "server default";
  return `${cpu} vCPU · ${memory} GB memory · disk: ${disk}`;
}

export function createFocusOrder(values: CreateFormValues): CreateFocus[] {
  const order: CreateFocus[] = ["image"];
  if (values.imageSource === "custom") {
    order.push("image-ref");
  } else if (values.imageSource === "dockerfile") {
    order.push("image-dockerfile-mode", "image-dockerfile");
  } else if (values.imageSource === "snapshot") {
    order.push("image-snapshot");
  }
  order.push("size");
  if (values.size === "custom") {
    order.push("size-cpu", "size-memory", "size-disk");
  }
  order.push("runtime", "stop-idle", "name", "submit");
  return order;
}

export function nextCreateFocus(
  values: CreateFormValues,
  current: CreateFocus,
  delta: number,
): CreateFocus {
  const order = createFocusOrder(values);
  const index = order.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + order.length) % order.length;
  return order[next] ?? "image";
}

export function imageOptionIndex(
  values: CreateFormValues,
  options: ImageOption[] = IMAGE_MENU_OPTIONS,
): number {
  const id =
    values.imageSource === "custom"
      ? "custom-image"
      : values.imageSource === "dockerfile"
        ? "dockerfile"
        : values.imageSource === "snapshot"
          ? SNAPSHOT_SOURCE_OPTION_ID
          : values.image;
  const index = options.findIndex((option) => option.id === id);
  return Math.max(index, 0);
}

export function snapshotOptionIndex(name: string, options: ImageOption[]): number {
  const index = options.findIndex(
    (option) => option.kind === "snapshot" && option.id === snapshotOptionId(name),
  );
  if (index >= 0) {
    return index;
  }
  return Math.max(
    options.findIndex((option) => !option.disabled),
    0,
  );
}

/** Applies an Image dropdown choice to the form. */
export function selectImageOption(values: CreateFormValues, option: ImageOption): CreateFormValues {
  switch (option.kind) {
    case "preset":
      return { ...values, imageSource: "preset", image: option.id };
    case "snapshot":
      return { ...values, imageSource: "snapshot" };
    case "custom":
      return { ...values, imageSource: "custom" };
    case "dockerfile":
      return { ...values, imageSource: "dockerfile" };
  }
}

/** Applies a Snapshot dropdown choice and prefills its size hints. */
export function selectSnapshotOption(
  values: CreateFormValues,
  option: ImageOption,
): CreateFormValues {
  if (option.kind !== "snapshot" || option.disabled || !option.snapshotName) {
    return values;
  }
  const selected: CreateFormValues = {
    ...values,
    imageSource: "snapshot",
    snapshotName: option.snapshotName,
  };
  const hasHint =
    option.cpu !== undefined || option.memoryMB !== undefined || option.diskGB !== undefined;
  if (!hasHint) {
    return selected;
  }
  const preset = sizePreset("default");
  if (!preset) {
    return selected;
  }
  return {
    ...selected,
    size: "custom",
    customCpu: String(option.cpu ?? preset.cpu),
    customMemoryGB: String((option.memoryMB ?? preset.memoryMB) / 1024),
    customDiskGB: String(option.diskGB ?? preset.diskGB),
  };
}

/** Label shown on the Image dropdown row. */
export function imageFieldValue(values: CreateFormValues): string {
  switch (values.imageSource) {
    case "preset":
      return values.image;
    case "snapshot":
      return "Snapshot";
    case "custom":
      return "Custom image";
    case "dockerfile":
      return "Dockerfile";
  }
}

/** Value of the Dockerfile row below the Image dropdown. */
export function dockerfileFieldValue(values: {
  dockerfileContents: string;
  dockerfilePath: string;
}): string {
  return values.dockerfileContents
    ? `Pasted Dockerfile · ${pastedDockerfileLines(values.dockerfileContents)} lines`
    : values.dockerfilePath;
}

export function pastedDockerfileLines(contents: string): number {
  if (contents.length === 0) {
    return 0;
  }
  return contents.replace(/\n+$/, "").split("\n").length;
}

export const DOCKERFILE_MODE_CHOICES: Array<{ id: DockerfileMode; label: string }> = [
  { id: "file", label: "From file" },
  { id: "paste", label: "Paste text" },
];

export function toggleDockerfileMode(mode: DockerfileMode): DockerfileMode {
  return mode === "file" ? "paste" : "file";
}

export function dockerfileModeLabel(mode: DockerfileMode): string {
  return mode === "file" ? "From file" : "Paste text";
}

/** The last `max` lines of a Dockerfile, for the clipped Contents preview. */
export function dockerfilePreviewLines(contents: string, max = 8): string[] {
  if (contents.length === 0) {
    return [];
  }
  const lines = contents.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  return lines.slice(-max);
}

export function expandHomePath(value: string, home: string = homedir()): string {
  if (value === "~") {
    return home;
  }
  if (value.startsWith("~/")) {
    return join(home, value.slice(2));
  }
  return value;
}

/** Expands `~` and resolves against the working directory. */
export function resolveDockerfilePath(
  value: string,
  cwd: string = process.cwd(),
  home: string = homedir(),
): string {
  const expanded = expandHomePath(value.trim(), home);
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
}

export function parseOptionalPositive(
  raw: string,
  label: string,
  integer: boolean,
): number | undefined {
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

export interface CreateSizeInput {
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
}

/**
 * Converts the size choice to create options. Custom memory is typed in GB and
 * rounded to whole MB; a result under 1 MB is rejected.
 */
export function createSizeInput(values: SizeFormValues): CreateSizeInput {
  const preset = sizePreset(values.size);
  if (preset) {
    return { cpu: preset.cpu, memoryMB: preset.memoryMB, diskGB: preset.diskGB };
  }

  const cpu = parseOptionalPositive(values.customCpu, "CPU", false);
  const memoryGB = parseOptionalPositive(values.customMemoryGB, "Memory", false);
  const diskGB = parseOptionalPositive(values.customDiskGB, "Disk", true);

  const input: CreateSizeInput = {};
  if (cpu !== undefined) {
    input.cpu = cpu;
  }
  if (memoryGB !== undefined) {
    const memoryMB = Math.round(memoryGB * 1024);
    if (memoryMB < 1) {
      throw new Error("Memory must be at least 1 MB.");
    }
    input.memoryMB = memoryMB;
  }
  if (diskGB !== undefined) {
    input.diskGB = diskGB;
  }
  return input;
}
