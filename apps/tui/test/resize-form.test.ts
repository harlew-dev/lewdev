import { describe, expect, test } from "bun:test";

import {
  nextResizeFocus,
  resizeFocusOrder,
  resizeSizeInput,
  resizeSummary,
  resizeValuesFromDetails,
} from "../src/resize-form";

describe("resize form", () => {
  test("matches a preset from the current size", () => {
    expect(resizeValuesFromDetails({ cpu: 8, memoryMB: 16384, diskGB: 80 })).toEqual({
      size: "large",
      customCpu: "",
      customMemoryGB: "",
      customDiskGB: "",
    });
  });

  test("uses custom values when the current size is not a preset", () => {
    expect(resizeValuesFromDetails({ cpu: 3, memoryMB: 6144, diskGB: 25 })).toEqual({
      size: "custom",
      customCpu: "3",
      customMemoryGB: "6",
      customDiskGB: "25",
    });
  });

  test("summarizes presets and custom values", () => {
    expect(
      resizeSummary({
        size: "large",
        customCpu: "",
        customMemoryGB: "",
        customDiskGB: "",
      }),
    ).toBe("8 vCPU · 16 GB memory · 80 GB disk");
    expect(
      resizeSummary({
        size: "custom",
        customCpu: "2",
        customMemoryGB: "4",
        customDiskGB: "",
      }),
    ).toBe("2 vCPU · 4 GB memory · disk: unchanged");
  });

  test("visits the custom fields only when custom is selected", () => {
    const preset = {
      size: "large" as const,
      customCpu: "",
      customMemoryGB: "",
      customDiskGB: "",
    };
    expect(resizeFocusOrder(preset)).toEqual(["size", "submit"]);
    expect(nextResizeFocus(preset, "size", 1)).toBe("submit");

    const custom = {
      size: "custom" as const,
      customCpu: "2",
      customMemoryGB: "4",
      customDiskGB: "20",
    };
    expect(resizeFocusOrder(custom)).toEqual([
      "size",
      "size-cpu",
      "size-memory",
      "size-disk",
      "submit",
    ]);
    expect(nextResizeFocus(custom, "size", 1)).toBe("size-cpu");
    expect(nextResizeFocus(custom, "submit", 1)).toBe("size");
  });

  test("turns presets and custom values into resize options", () => {
    expect(
      resizeSizeInput({
        size: "small",
        customCpu: "",
        customMemoryGB: "",
        customDiskGB: "",
      }),
    ).toEqual({ cpu: 2, memoryMB: 4096, diskGB: 20 });
    expect(
      resizeSizeInput({
        size: "custom",
        customCpu: "0.5",
        customMemoryGB: "0.5",
        customDiskGB: "20",
      }),
    ).toEqual({ cpu: 0.5, memoryMB: 512, diskGB: 20 });
    expect(
      resizeSizeInput({
        size: "custom",
        customCpu: "",
        customMemoryGB: "",
        customDiskGB: "",
      }),
    ).toEqual({});
  });
});
