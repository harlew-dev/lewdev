import type { SandboxDetails } from "@lewdev/core";

import {
  type CreateSizeInput,
  createSizeInput,
  type SizeFormValues,
  SIZE_PRESETS,
  sizePreset,
} from "./create-form";

export type ResizeFocus = "size" | "size-cpu" | "size-memory" | "size-disk" | "submit";

export type ResizeFormValues = SizeFormValues;

/** Seeds the form from the current size, matching a preset when possible. */
export function resizeValuesFromDetails(
  details: Pick<SandboxDetails, "cpu" | "memoryMB" | "diskGB">,
): ResizeFormValues {
  const preset = SIZE_PRESETS.find(
    (entry) =>
      entry.cpu === details.cpu &&
      entry.memoryMB === details.memoryMB &&
      entry.diskGB === details.diskGB,
  );
  if (preset) {
    return {
      size: preset.id,
      customCpu: "",
      customMemoryGB: "",
      customDiskGB: "",
    };
  }
  return {
    size: "custom",
    customCpu: String(details.cpu),
    customMemoryGB: String(details.memoryMB / 1024),
    customDiskGB: String(details.diskGB),
  };
}

export function resizeSummary(values: ResizeFormValues): string {
  const preset = sizePreset(values.size);
  if (preset) {
    return `${preset.cpu} vCPU · ${preset.memoryMB / 1024} GB memory · ${preset.diskGB} GB disk`;
  }
  const cpu = values.customCpu.trim() || "unchanged";
  const memory = values.customMemoryGB.trim() || "unchanged";
  const disk = values.customDiskGB.trim() || "unchanged";
  return `${cpu} vCPU · ${memory} GB memory · disk: ${disk}`;
}

export function resizeFocusOrder(values: ResizeFormValues): ResizeFocus[] {
  const order: ResizeFocus[] = ["size"];
  if (values.size === "custom") {
    order.push("size-cpu", "size-memory", "size-disk");
  }
  order.push("submit");
  return order;
}

export function nextResizeFocus(
  values: ResizeFormValues,
  current: ResizeFocus,
  delta: number,
): ResizeFocus {
  const order = resizeFocusOrder(values);
  const index = order.indexOf(current);
  const base = Math.max(index, 0);
  const next = (base + delta + order.length) % order.length;
  return order[next] ?? "size";
}

export function resizeSizeInput(values: ResizeFormValues): CreateSizeInput {
  return createSizeInput(values);
}
