import { describe, expect, test } from "bun:test";

import {
  PORT_VISIBILITY_OPTIONS,
  visibilityLabel,
  visibilityOption,
  visibilityTableLabel,
} from "../src/port-options";

describe("port visibility", () => {
  test("offers public and private with descriptions", () => {
    expect(PORT_VISIBILITY_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      ["public", "Public"],
      ["token", "Private"],
    ]);
    expect(visibilityOption("public").description).toBe("Anyone with the URL can reach this port.");
    expect(visibilityOption("token").description).toBe("Needs a sandbox token for this port.");
  });

  test("uses Private in the form and private in the table", () => {
    expect(visibilityLabel("token")).toBe("Private");
    expect(visibilityTableLabel("token")).toBe("private");
    expect(visibilityLabel("public")).toBe("Public");
    expect(visibilityTableLabel(undefined)).toBe("public");
  });
});
