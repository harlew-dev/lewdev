import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import {
  CREATE_DEFAULT,
  type CreateFormValues,
  createFocusOrder,
  createSizeInput,
  createSizeSummary,
  dockerfileFieldValue,
  expandHomePath,
  IMAGE_OPTIONS,
  imageFieldValue,
  imageOptionIndex,
  moveSize,
  nextCreateFocus,
  pastedDockerfileLines,
  resolveDockerfilePath,
  selectImageOption,
  SIZE_PRESETS,
} from "../src/create-form";

function values(overrides: Partial<CreateFormValues> = {}): CreateFormValues {
  return { ...CREATE_DEFAULT, ...overrides };
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
      "image-dockerfile",
      "size",
      "name",
      "submit",
    ]);
    expect(nextCreateFocus(values({ imageSource: "custom" }), "image", 1)).toBe("image-ref");
    expect(nextCreateFocus(values({ imageSource: "dockerfile" }), "image-dockerfile", 1)).toBe(
      "size",
    );
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
  test("lists the presets, custom image and Dockerfile", () => {
    expect(IMAGE_OPTIONS.map((option) => option.label)).toEqual([
      "ubuntu:24.04",
      "ubuntu:22.04",
      "debian:12",
      "alpine:3.22",
      "node:22",
      "python:3.13",
      "golang:1.25",
      "Custom image…",
      "Dockerfile…",
    ]);
  });

  test("maps the current source to a menu index", () => {
    expect(imageOptionIndex(values())).toBe(0);
    expect(imageOptionIndex(values({ imageSource: "custom" }))).toBe(7);
    expect(imageOptionIndex(values({ imageSource: "dockerfile" }))).toBe(8);
    expect(imageOptionIndex(values({ image: "node:22" }))).toBe(4);
  });

  test("applies a selection", () => {
    expect(selectImageOption(values(), IMAGE_OPTIONS[2] as never).image).toBe("debian:12");
    expect(selectImageOption(values(), IMAGE_OPTIONS[7] as never).imageSource).toBe("custom");
    expect(selectImageOption(values(), IMAGE_OPTIONS[8] as never).imageSource).toBe("dockerfile");
  });

  test("keeps the Image row showing the chosen source", () => {
    expect(imageFieldValue(values({ imageSource: "custom", customImage: "node:22" }))).toBe(
      "Custom image",
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
