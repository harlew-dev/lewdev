import { describe, expect, test } from "bun:test";
import type { SnapshotInfo } from "@lewdev/core";
import { join, resolve } from "node:path";

import {
  buildSnapshotMenuOptions,
  CREATE_DEFAULT,
  type CreateFormValues,
  createFocusOrder,
  createSizeInput,
  createSizeSummary,
  dockerfileFieldValue,
  dockerfileModeLabel,
  dockerfilePreviewLines,
  expandHomePath,
  imageFieldValue,
  type ImageOption,
  IMAGE_MENU_OPTIONS,
  imageOptionIndex,
  menuOptionAt,
  moveSize,
  nextCreateFocus,
  nextMenuIndex,
  pastedDockerfileLines,
  resolveDockerfilePath,
  selectImageOption,
  selectSnapshotOption,
  SIZE_PRESETS,
  snapshotOptionIndex,
  toggleDockerfileMode,
} from "../src/create-form";

function values(overrides: Partial<CreateFormValues> = {}): CreateFormValues {
  return { ...CREATE_DEFAULT, ...overrides };
}

function snapshot(overrides: Partial<SnapshotInfo> = {}): SnapshotInfo {
  return {
    name: "golden",
    image: "ghcr.io/acme/base:1",
    sourceSandboxID: "sb-1",
    createdAt: "2026-11-25T10:00:00Z",
    ...overrides,
  };
}

function labels(options: ImageOption[]): string[] {
  return options.map((option) => option.label);
}

function indexOf(options: ImageOption[], label: string): number {
  return options.findIndex((option) => option.label === label);
}

describe("size choices", () => {
  test("defines the four presets and custom", () => {
    expect(
      SIZE_PRESETS.map((preset) => [preset.id, preset.cpu, preset.memoryMB, preset.diskGB]),
    ).toEqual([
      ["small", 2, 4096, 20],
      ["default", 4, 8192, 40],
      ["large", 8, 16384, 80],
      ["xlarge", 16, 32768, 160],
    ]);
    expect(CREATE_DEFAULT.size).toBe("default");
  });

  test("moves and wraps through the cards", () => {
    expect(moveSize("small", 1)).toBe("default");
    expect(moveSize("xlarge", 1)).toBe("custom");
    expect(moveSize("custom", 1)).toBe("small");
    expect(moveSize("small", -1)).toBe("custom");
  });

  test("summarizes presets and custom sizes", () => {
    expect(createSizeSummary(values())).toBe("4 vCPU · 8 GB memory · 40 GB disk");
    expect(createSizeSummary(values({ size: "xlarge" }))).toBe(
      "16 vCPU · 32 GB memory · 160 GB disk",
    );
    expect(
      createSizeSummary(
        values({ size: "custom", customCpu: "0.5", customMemoryGB: "0.5", customDiskGB: "20" }),
      ),
    ).toBe("0.5 vCPU · 0.5 GB memory · disk: 20");
    expect(createSizeSummary(values({ size: "custom" }))).toBe(
      "— vCPU · — GB memory · disk: server default",
    );
  });

  test("turns presets and custom values into create options", () => {
    expect(createSizeInput(values())).toEqual({ cpu: 4, memoryMB: 8192, diskGB: 40 });
    expect(
      createSizeInput(
        values({ size: "custom", customCpu: "0.5", customMemoryGB: "0.5", customDiskGB: "20" }),
      ),
    ).toEqual({ cpu: 0.5, memoryMB: 512, diskGB: 20 });
    expect(createSizeInput(values({ size: "custom" }))).toEqual({});
  });

  test("rounds fractional GB to whole MB and rejects results under 1 MB", () => {
    expect(createSizeInput(values({ size: "custom", customMemoryGB: "1.1" }))).toEqual({
      memoryMB: 1126,
    });
    expect(() => createSizeInput(values({ size: "custom", customMemoryGB: "0.0001" }))).toThrow(
      "Memory must be at least 1 MB.",
    );
  });

  test("rejects non-positive and fractional disk values", () => {
    expect(() => createSizeInput(values({ size: "custom", customCpu: "0" }))).toThrow(
      "CPU must be a positive number.",
    );
    expect(() => createSizeInput(values({ size: "custom", customDiskGB: "1.5" }))).toThrow(
      "Disk must be a whole number.",
    );
  });
});

describe("focus order", () => {
  test("visits image, size and name for presets", () => {
    expect(createFocusOrder(values())).toEqual(["image", "size", "name", "submit"]);
  });

  test("adds the image sub-field when a custom image or Dockerfile is picked", () => {
    expect(createFocusOrder(values({ imageSource: "custom" }))).toEqual([
      "image",
      "image-ref",
      "size",
      "name",
      "submit",
    ]);
    expect(createFocusOrder(values({ imageSource: "dockerfile" }))).toEqual([
      "image",
      "image-dockerfile-mode",
      "image-dockerfile",
      "size",
      "name",
      "submit",
    ]);
    expect(createFocusOrder(values({ imageSource: "snapshot" }))).toEqual([
      "image",
      "image-snapshot",
      "size",
      "name",
      "submit",
    ]);
    expect(nextCreateFocus(values({ imageSource: "custom" }), "image", 1)).toBe("image-ref");
    expect(nextCreateFocus(values({ imageSource: "dockerfile" }), "image-dockerfile", 1)).toBe(
      "size",
    );
    expect(nextCreateFocus(values({ imageSource: "snapshot" }), "image", 1)).toBe("image-snapshot");
  });

  test("visits the custom size fields when custom is selected", () => {
    const custom = values({ size: "custom" });
    expect(createFocusOrder(custom)).toEqual([
      "image",
      "size",
      "size-cpu",
      "size-memory",
      "size-disk",
      "name",
      "submit",
    ]);
    expect(nextCreateFocus(custom, "size", 1)).toBe("size-cpu");
    expect(nextCreateFocus(custom, "name", 1)).toBe("submit");
    expect(nextCreateFocus(custom, "submit", 1)).toBe("image");
    expect(nextCreateFocus(custom, "image", -1)).toBe("submit");
  });
});

describe("image options", () => {
  test("lists Dockerfile, Custom image, Snapshot, then the presets", () => {
    expect(labels(IMAGE_MENU_OPTIONS)).toEqual([
      "Dockerfile…",
      "Custom image…",
      "Snapshot…",
      "ubuntu:24.04",
      "ubuntu:22.04",
      "debian:12",
      "alpine:3.22",
      "node:22",
      "python:3.13",
      "golang:1.25",
    ]);
  });

  test("maps the current source to an image menu index", () => {
    expect(imageOptionIndex(values())).toBe(indexOf(IMAGE_MENU_OPTIONS, "ubuntu:24.04"));
    expect(imageOptionIndex(values({ imageSource: "custom" }))).toBe(
      indexOf(IMAGE_MENU_OPTIONS, "Custom image…"),
    );
    expect(imageOptionIndex(values({ imageSource: "dockerfile" }))).toBe(
      indexOf(IMAGE_MENU_OPTIONS, "Dockerfile…"),
    );
    expect(imageOptionIndex(values({ image: "node:22" }))).toBe(
      indexOf(IMAGE_MENU_OPTIONS, "node:22"),
    );
    expect(imageOptionIndex(values({ imageSource: "snapshot", snapshotName: "golden" }))).toBe(
      indexOf(IMAGE_MENU_OPTIONS, "Snapshot…"),
    );
  });

  test("applies an image selection and keeps a previously chosen snapshot", () => {
    const dockerfile = menuOptionAt(IMAGE_MENU_OPTIONS, indexOf(IMAGE_MENU_OPTIONS, "Dockerfile…"));
    const custom = menuOptionAt(IMAGE_MENU_OPTIONS, indexOf(IMAGE_MENU_OPTIONS, "Custom image…"));
    const snapshotSource = menuOptionAt(
      IMAGE_MENU_OPTIONS,
      indexOf(IMAGE_MENU_OPTIONS, "Snapshot…"),
    );
    const debian = menuOptionAt(IMAGE_MENU_OPTIONS, indexOf(IMAGE_MENU_OPTIONS, "debian:12"));
    if (!dockerfile || !custom || !snapshotSource || !debian) {
      throw new Error("image options missing");
    }

    expect(selectImageOption(values(), debian).image).toBe("debian:12");
    expect(selectImageOption(values(), custom).imageSource).toBe("custom");
    expect(selectImageOption(values(), dockerfile).imageSource).toBe("dockerfile");
    expect(
      selectImageOption(values({ snapshotName: "golden", size: "large" }), snapshotSource),
    ).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "golden",
      size: "large",
    });
  });

  test("lists snapshot options or a disabled status row", () => {
    const loaded = buildSnapshotMenuOptions([snapshot()], true);
    expect(labels(loaded)).toEqual(["golden"]);
    expect(loaded[0]?.snapshotName).toBe("golden");
    expect(loaded[0]?.detail).toContain("ghcr.io/acme/base:1");
    expect(loaded[0]?.disabled).toBeUndefined();
    expect(snapshotOptionIndex("golden", loaded)).toBe(0);
    expect(snapshotOptionIndex("missing", loaded)).toBe(0);

    expect(labels(buildSnapshotMenuOptions([], false))).toEqual(["Loading snapshots…"]);
    expect(buildSnapshotMenuOptions([], false)[0]?.disabled).toBe(true);
    expect(labels(buildSnapshotMenuOptions([], true))).toEqual(["No snapshots"]);
    expect(buildSnapshotMenuOptions([], true)[0]?.disabled).toBe(true);
  });

  test("selects a snapshot and prefills custom size from its hints", () => {
    const option = buildSnapshotMenuOptions(
      [snapshot({ cpu: 2, memoryMB: 4096, diskGB: 20 })],
      true,
    )[0];
    if (!option) {
      throw new Error("snapshot option missing");
    }

    expect(selectSnapshotOption(values(), option)).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "golden",
      size: "custom",
      customCpu: "2",
      customMemoryGB: "4",
      customDiskGB: "20",
    });
  });

  test("uses the default preset for missing snapshot hints", () => {
    const option = buildSnapshotMenuOptions([snapshot({ cpu: 2 })], true)[0];
    if (!option) {
      throw new Error("snapshot option missing");
    }

    expect(selectSnapshotOption(values({ size: "large" }), option)).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "golden",
      size: "custom",
      customCpu: "2",
      customMemoryGB: "8",
      customDiskGB: "40",
    });
  });

  test("leaves the size alone when a snapshot has no hints", () => {
    const option = buildSnapshotMenuOptions([snapshot()], true)[0];
    if (!option) {
      throw new Error("snapshot option missing");
    }

    expect(selectSnapshotOption(values({ size: "large" }), option)).toMatchObject({
      imageSource: "snapshot",
      snapshotName: "golden",
      size: "large",
      customCpu: "",
    });
  });

  test("moves through options and skips disabled rows", () => {
    expect(nextMenuIndex(IMAGE_MENU_OPTIONS, 0, 1)).toBe(1);
    expect(nextMenuIndex(IMAGE_MENU_OPTIONS, indexOf(IMAGE_MENU_OPTIONS, "Snapshot…"), -1)).toBe(
      indexOf(IMAGE_MENU_OPTIONS, "Custom image…"),
    );

    const withDisabled: ImageOption[] = [
      { id: "loading", label: "Loading", kind: "snapshot", disabled: true },
      { id: "golden", label: "golden", kind: "snapshot", snapshotName: "golden" },
    ];
    expect(nextMenuIndex(withDisabled, 0, 1)).toBe(1);
    expect(nextMenuIndex(withDisabled, 1, 1)).toBe(1);
  });

  test("keeps the Image row showing the chosen source", () => {
    expect(imageFieldValue(values({ imageSource: "custom", customImage: "node:22" }))).toBe(
      "Custom image",
    );
    expect(imageFieldValue(values({ imageSource: "snapshot", snapshotName: "golden" }))).toBe(
      "Snapshot",
    );
    expect(imageFieldValue(values({ imageSource: "dockerfile" }))).toBe("Dockerfile");
  });

  test("shows the Dockerfile path or pasted contents with a line count", () => {
    expect(
      dockerfileFieldValue(
        values({
          imageSource: "dockerfile",
          dockerfileContents: "FROM ubuntu:24.04\nRUN echo hi\n",
        }),
      ),
    ).toBe("Pasted Dockerfile · 2 lines");
    expect(
      dockerfileFieldValue(values({ imageSource: "dockerfile", dockerfilePath: "~/Dockerfile" })),
    ).toBe("~/Dockerfile");
  });
});

describe("dockerfile modes", () => {
  test("toggles and labels the two input modes", () => {
    expect(toggleDockerfileMode("file")).toBe("paste");
    expect(toggleDockerfileMode("paste")).toBe("file");
    expect(dockerfileModeLabel("file")).toBe("From file");
    expect(dockerfileModeLabel("paste")).toBe("Paste text");
  });

  test("previews only the last lines and ignores a trailing newline", () => {
    expect(dockerfilePreviewLines("")).toEqual([]);
    expect(dockerfilePreviewLines("FROM ubuntu\nRUN echo hi\n")).toEqual([
      "FROM ubuntu",
      "RUN echo hi",
    ]);
    const many = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n");
    expect(dockerfilePreviewLines(many)).toEqual([
      "line 3",
      "line 4",
      "line 5",
      "line 6",
      "line 7",
      "line 8",
      "line 9",
      "line 10",
    ]);
  });
});

describe("dockerfile paths", () => {
  test("expands ~ and resolves relative paths", () => {
    expect(expandHomePath("~/Builds/Dockerfile", "/home/me")).toBe(
      join("/home/me", "Builds/Dockerfile"),
    );
    expect(expandHomePath("~", "/home/me")).toBe("/home/me");
    expect(resolveDockerfilePath("docker/Dockerfile", "/work", "/home/me")).toBe(
      resolve("/work", "docker/Dockerfile"),
    );
    expect(resolveDockerfilePath("~/Dockerfile", "/work", "/home/me")).toBe(
      join("/home/me", "Dockerfile"),
    );
  });

  test("counts pasted lines", () => {
    expect(pastedDockerfileLines("")).toBe(0);
    expect(pastedDockerfileLines("FROM scratch\n")).toBe(1);
    expect(pastedDockerfileLines("FROM scratch\nRUN echo hi\n\n")).toBe(2);
  });
});
