import { describe, expect, test } from "bun:test";

import { wrapToastMessage } from "../src/components";

describe("wrapToastMessage", () => {
  test("keeps a short message on one line", () => {
    expect(wrapToastMessage("Copied SSH command", 80)).toEqual(["Copied SSH command"]);
  });

  test("wraps long messages to at most two lines with an ellipsis", () => {
    const message = "word ".repeat(60).trim();
    const lines = wrapToastMessage(message, 40);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    for (const line of lines) {
      expect([...line].length).toBeLessThanOrEqual(40 - 6);
    }
  });

  test("splits a single long word without exceeding the width", () => {
    const lines = wrapToastMessage("x".repeat(200), 30);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect([...line].length).toBeLessThanOrEqual(30 - 6);
    }
  });
});
