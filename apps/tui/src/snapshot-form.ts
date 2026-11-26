import type { SnapshotInfo } from "@lewdev/core";

import {
  CREATE_DEFAULT,
  type CreateFormValues,
  type DockerfileMode,
  parseOptionalPositive,
  selectSnapshotOption,
  snapshotImageOption,
} from "./create-form";

export type SnapshotSource = "image" | "dockerfile";

export type NewSnapshotFocus =
  | "name"
  | "source"
  | "image-ref"
  | "dockerfile-mode"
  | "dockerfile"
  | "cpu"
  | "memory"
  | "disk"
  | "submit";

export interface NewSnapshotFormValues {
  name: string;
  source: SnapshotSource;
  image: string;
  dockerfileMode: DockerfileMode;
  dockerfilePath: string;
  dockerfileContents: string;
  cpu: string;
  memoryGB: string;
  diskGB: string;
}

export const NEW_SNAPSHOT_DEFAULT: NewSnapshotFormValues = {
  name: "",
  source: "image",
  image: "",
  dockerfileMode: "file",
  dockerfilePath: "",
  dockerfileContents: "",
  cpu: "",
  memoryGB: "",
  diskGB: "",
};

export function toggleSnapshotSource(source: SnapshotSource): SnapshotSource {
  return source === "image" ? "dockerfile" : "image";
}

export function snapshotSourceLabel(source: SnapshotSource): string {
  return source === "image" ? "Image reference" : "Dockerfile";
}

export function newSnapshotFocusOrder(values: NewSnapshotFormValues): NewSnapshotFocus[] {
  return [
    "name",
    "source",
    ...(values.source === "image"
      ? (["image-ref"] as const)
      : (["dockerfile-mode", "dockerfile"] as const)),
    "cpu",
    "memory",
    "disk",
    "submit",
  ];
}

export function nextNewSnapshotFocus(
  values: NewSnapshotFormValues,
  current: NewSnapshotFocus,
  delta: number,
): NewSnapshotFocus {
  const order = newSnapshotFocusOrder(values);
  const index = order.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + order.length) % order.length;
  return order[next] ?? "name";
}

export function newSnapshotSizeInput(values: NewSnapshotFormValues): {
  cpu?: number;
  memoryMB?: number;
  diskGB?: number;
} {
  const cpu = parseOptionalPositive(values.cpu, "CPU", false);
  const memoryGB = parseOptionalPositive(values.memoryGB, "Memory", false);
  const diskGB = parseOptionalPositive(values.diskGB, "Disk", true);

  const input: { cpu?: number; memoryMB?: number; diskGB?: number } = {};
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

/** Values for the New sandbox form when booting from a snapshot as its image. */
export function createValuesFromSnapshot(snapshot: SnapshotInfo): CreateFormValues {
  return selectSnapshotOption(CREATE_DEFAULT, snapshotImageOption(snapshot));
}
