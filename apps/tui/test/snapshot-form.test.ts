import { describe, expect, test } from "bun:test";
import type { SnapshotInfo } from "@lewdev/core";

import {
  createValuesFromSnapshot,
  NEW_SNAPSHOT_DEFAULT,
  newSnapshotFocusOrder,
  newSnapshotSizeInput,
  nextNewSnapshotFocus,
  snapshotSourceLabel,
  toggleSnapshotSource,
} from "../src/snapshot-form";

describe("new snapshot form", () => {
  test("toggles the source and names both choices", () => {
    expect(toggleSnapshotSource("image")).toBe("dockerfile");
    expect(toggleSnapshotSource("dockerfile")).toBe("image");
    expect(snapshotSourceLabel("image")).toBe("Image reference");
    expect(snapshotSourceLabel("dockerfile")).toBe("Dockerfile");
  });

  test("walks the fields in order and wraps", () => {
    expect(newSnapshotFocusOrder(NEW_SNAPSHOT_DEFAULT)).toEqual([
      "name",
      "source",
      "image-ref",
      "cpu",
      "memory",
      "disk",
      "submit",
    ]);
    expect(newSnapshotFocusOrder({ ...NEW_SNAPSHOT_DEFAULT, source: "dockerfile" })).toEqual([
      "name",
      "source",
      "dockerfile-mode",
      "dockerfile",
      "cpu",
      "memory",
      "disk",
      "submit",
    ]);
    expect(nextNewSnapshotFocus(NEW_SNAPSHOT_DEFAULT, "name", 1)).toBe("source");
    expect(nextNewSnapshotFocus(NEW_SNAPSHOT_DEFAULT, "name", -1)).toBe("submit");
  });

  test("parses optional CPU, memory and disk hints", () => {
    expect(newSnapshotSizeInput(NEW_SNAPSHOT_DEFAULT)).toEqual({});
    expect(
      newSnapshotSizeInput({
        ...NEW_SNAPSHOT_DEFAULT,
        cpu: "1.5",
        memoryGB: "1.5",
        diskGB: " 20 ",
      }),
    ).toEqual({ cpu: 1.5, memoryMB: 1536, diskGB: 20 });
    expect(() => newSnapshotSizeInput({ ...NEW_SNAPSHOT_DEFAULT, memoryGB: "0" })).toThrow(
      "Memory must be a positive number.",
    );
    expect(() => newSnapshotSizeInput({ ...NEW_SNAPSHOT_DEFAULT, diskGB: "1.5" })).toThrow(
      "Disk must be a whole number.",
    );
  });

  test("prefills the sandbox form with the snapshot source and size hints", () => {
    const snapshot: SnapshotInfo = {
      name: "golden",
      image: "ubuntu:24.04",
      sourceSandboxID: "sb-1",
      createdAt: "2026-11-25T10:00:00Z",
      cpu: 2,
      memoryMB: 4096,
      diskGB: 20,
    };

    expect(createValuesFromSnapshot(snapshot)).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "golden",
      size: "custom",
      customCpu: "2",
      customMemoryGB: "4",
      customDiskGB: "20",
    });

    expect(
      createValuesFromSnapshot({
        name: "bare",
        image: "ubuntu:24.04",
        sourceSandboxID: "sb-1",
        createdAt: "2026-11-25T10:00:00Z",
      }),
    ).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "bare",
      size: "default",
      customCpu: "",
      customMemoryGB: "",
      customDiskGB: "",
    });
  });
});
