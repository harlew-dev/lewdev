import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export type ImageSource = "preset" | "custom" | "dockerfile";
export type SizeId = "small" | "default" | "large" | "xlarge" | "custom";
export type CreateFocus =
  | "image"
  | "image-ref"
  | "image-dockerfile"
  | "size"
  | "size-cpu"
  | "size-memory"
  | "size-disk"
  | "name"
  | "submit";

export interface CreateFormValues {
  imageSource: ImageSource;
  image: string;
  customImage: string;
  dockerfilePath: string;
  dockerfileContents: string;
  size: SizeId;
  customCpu: string;
  customMemoryGB: string;
  customDiskGB: string;
  name: string;
}

export const CREATE_DEFAULT: CreateFormValues = {
  imageSource: "preset",
  image: "ubuntu:24.04",
  customImage: "",
  dockerfilePath: "",
  dockerfileContents: "",
  size: "default",
  customCpu: "",
  customMemoryGB: "",
  customDiskGB: "",
  name: "",
};

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
  kind: "preset" | "custom" | "dockerfile";
}

export const IMAGE_OPTIONS: ImageOption[] = [
  ...IMAGE_PRESETS.map((image) => ({ id: image, label: image, kind: "preset" as const })),
  { id: "custom-image", label: "Custom image…", kind: "custom" },
  { id: "dockerfile", label: "Dockerfile…", kind: "dockerfile" },
];

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

export function createSizeSummary(values: CreateFormValues): string {
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
    order.push("image-dockerfile");
  }
  order.push("size");
  if (values.size === "custom") {
    order.push("size-cpu", "size-memory", "size-disk");
  }
  order.push("name", "submit");
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

export function imageOptionIndex(values: CreateFormValues): number {
  const id =
    values.imageSource === "custom"
      ? "custom-image"
      : values.imageSource === "dockerfile"
        ? "dockerfile"
        : values.image;
  const index = IMAGE_OPTIONS.findIndex((option) => option.id === id);
  return Math.max(index, 0);
}

/** Applies an image dropdown choice to the form. */
export function selectImageOption(values: CreateFormValues, option: ImageOption): CreateFormValues {
  switch (option.kind) {
    case "preset":
      return { ...values, imageSource: "preset", image: option.id };
    case "custom":
      return { ...values, imageSource: "custom" };
    case "dockerfile":
      return { ...values, imageSource: "dockerfile" };
  }
}

/** Label shown on the Image dropdown row. */
export function imageFieldValue(values: CreateFormValues): string {
  switch (values.imageSource) {
    case "preset":
      return values.image;
    case "custom":
      return "Custom image";
    case "dockerfile":
      return "Dockerfile";
  }
}

/** Value of the Dockerfile row below the Image dropdown. */
export function dockerfileFieldValue(values: CreateFormValues): string {
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

function parseOptionalPositive(raw: string, label: string, integer: boolean): number | undefined {
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
export function createSizeInput(values: CreateFormValues): CreateSizeInput {
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
