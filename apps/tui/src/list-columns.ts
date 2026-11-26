export type ListColumn =
  | "cursor"
  | "name"
  | "id"
  | "source"
  | "image"
  | "status"
  | "cpu"
  | "memory"
  | "disk"
  | "created";

export type SnapshotListColumn =
  | "cursor"
  | "name"
  | "source"
  | "image"
  | "cpu"
  | "memory"
  | "disk"
  | "created";

/** Fixed column widths; the table never renders a column partially. */
export const LIST_COLUMN_WIDTHS: Record<ListColumn, number> = {
  cursor: 2,
  name: 16,
  id: 13,
  source: 14,
  image: 16,
  status: 12,
  cpu: 9,
  memory: 10,
  disk: 9,
  created: 9,
};

export const LIST_COLUMNS: ListColumn[] = [
  "cursor",
  "name",
  "id",
  "image",
  "status",
  "cpu",
  "memory",
  "disk",
  "created",
];

const DROP_ORDER: ListColumn[] = ["created", "disk", "id"];

/**
 * Chooses the columns that fit the card's inner width. CREATED is dropped
 * first, then DISK, then ID; STATUS always stays so the badge remains intact.
 */
export function visibleListColumns(innerWidth: number): ListColumn[] {
  const dropped = new Set<ListColumn>();
  const widthOf = (columns: ListColumn[]): number =>
    columns.reduce((total, column) => total + LIST_COLUMN_WIDTHS[column], 0);

  if (widthOf(LIST_COLUMNS) > innerWidth) {
    for (const column of DROP_ORDER) {
      dropped.add(column);
      if (widthOf(LIST_COLUMNS.filter((entry) => !dropped.has(entry))) <= innerWidth) {
        break;
      }
    }
  }

  return LIST_COLUMNS.filter((column) => !dropped.has(column));
}

export const SNAPSHOT_COLUMN_WIDTHS: Record<SnapshotListColumn, number> = {
  cursor: LIST_COLUMN_WIDTHS.cursor,
  name: LIST_COLUMN_WIDTHS.name,
  source: LIST_COLUMN_WIDTHS.source,
  image: LIST_COLUMN_WIDTHS.image,
  cpu: LIST_COLUMN_WIDTHS.cpu,
  memory: LIST_COLUMN_WIDTHS.memory,
  disk: LIST_COLUMN_WIDTHS.disk,
  created: LIST_COLUMN_WIDTHS.created,
};

export const SNAPSHOT_COLUMNS: SnapshotListColumn[] = [
  "cursor",
  "name",
  "source",
  "image",
  "cpu",
  "memory",
  "disk",
  "created",
];

const SNAPSHOT_DROP_ORDER: SnapshotListColumn[] = ["created", "disk", "source"];

/**
 * Chooses the snapshot columns that fit the card's inner width. CREATED is
 * dropped first, then DISK, then SOURCE; the name and image always stay.
 */
export function visibleSnapshotColumns(innerWidth: number): SnapshotListColumn[] {
  const dropped = new Set<SnapshotListColumn>();
  const widthOf = (columns: SnapshotListColumn[]): number =>
    columns.reduce((total, column) => total + SNAPSHOT_COLUMN_WIDTHS[column], 0);

  if (widthOf(SNAPSHOT_COLUMNS) > innerWidth) {
    for (const column of SNAPSHOT_DROP_ORDER) {
      dropped.add(column);
      if (widthOf(SNAPSHOT_COLUMNS.filter((entry) => !dropped.has(entry))) <= innerWidth) {
        break;
      }
    }
  }

  return SNAPSHOT_COLUMNS.filter((column) => !dropped.has(column));
}
