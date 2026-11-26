import { describe, expect, test } from "bun:test";

import {
  LIST_COLUMN_WIDTHS,
  SNAPSHOT_COLUMN_WIDTHS,
  visibleListColumns,
  visibleSnapshotColumns,
} from "../src/list-columns";

function widthOf(columns: ReturnType<typeof visibleListColumns>): number {
  return columns.reduce((total, column) => total + LIST_COLUMN_WIDTHS[column], 0);
}

function snapshotWidthOf(columns: ReturnType<typeof visibleSnapshotColumns>): number {
  return columns.reduce((total, column) => total + SNAPSHOT_COLUMN_WIDTHS[column], 0);
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

describe("snapshot list columns", () => {
  test("shows every column when the card is wide enough", () => {
    expect(visibleSnapshotColumns(96)).toEqual([
      "cursor",
      "name",
      "source",
      "image",
      "cpu",
      "memory",
      "disk",
      "created",
    ]);
  });

  test("drops CREATED first, then DISK, then SOURCE", () => {
    const noCreated = visibleSnapshotColumns(80);
    expect(noCreated).not.toContain("created");
    expect(noCreated).toContain("disk");
    expect(noCreated).toContain("source");
    expect(snapshotWidthOf(noCreated)).toBe(76);

    const noDisk = visibleSnapshotColumns(74);
    expect(noDisk).not.toContain("created");
    expect(noDisk).not.toContain("disk");
    expect(noDisk).toContain("source");
    expect(snapshotWidthOf(noDisk)).toBe(67);

    const noSource = visibleSnapshotColumns(55);
    expect(noSource).toEqual(["cursor", "name", "image", "cpu", "memory"]);
    expect(snapshotWidthOf(noSource)).toBe(53);
  });

  test("always keeps the name, image and size columns", () => {
    for (const width of [120, 90, 74, 55, 40, 0]) {
      const columns = visibleSnapshotColumns(width);
      for (const column of ["cursor", "name", "image", "cpu", "memory"] as const) {
        expect(columns).toContain(column);
      }
    }
  });
});
