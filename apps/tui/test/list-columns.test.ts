import { describe, expect, test } from "bun:test";

import { LIST_COLUMN_WIDTHS, visibleListColumns } from "../src/list-columns";

function widthOf(columns: ReturnType<typeof visibleListColumns>): number {
  return columns.reduce((total, column) => total + LIST_COLUMN_WIDTHS[column], 0);
}

describe("list columns", () => {
  test("shows every column when the card is wide enough", () => {
    const columns = visibleListColumns(96);
    expect(columns).toEqual([
      "cursor",
      "name",
      "id",
      "image",
      "status",
      "cpu",
      "memory",
      "disk",
      "created",
    ]);
  });

  test("drops CREATED first", () => {
    const columns = visibleListColumns(90);
    expect(columns).not.toContain("created");
    expect(columns).toContain("disk");
    expect(columns).toContain("id");
    expect(widthOf(columns)).toBe(87);
  });

  test("drops DISK next while keeping ID", () => {
    const columns = visibleListColumns(80);
    expect(columns).not.toContain("created");
    expect(columns).not.toContain("disk");
    expect(columns).toContain("id");
    expect(widthOf(columns)).toBe(78);
  });

  test("drops ID at 80x24's inner width", () => {
    const columns = visibleListColumns(74);
    expect(columns).toEqual(["cursor", "name", "image", "status", "cpu", "memory"]);
    expect(widthOf(columns)).toBe(65);
  });

  test("always keeps the status badge and never returns a partial column", () => {
    for (const width of [120, 100, 90, 80, 74, 65, 40, 0]) {
      const columns = visibleListColumns(width);
      expect(columns).toContain("status");
      expect(columns).toContain("cursor");
      expect(columns).toContain("name");
      expect(columns).toContain("image");
      expect(columns).toContain("cpu");
      expect(columns).toContain("memory");
      for (const column of columns) {
        expect(LIST_COLUMN_WIDTHS[column]).toBeGreaterThan(0);
      }
    }
  });
});
