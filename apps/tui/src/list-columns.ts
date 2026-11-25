export type ListColumn =
  | "cursor"
  | "name"
  | "id"
  | "image"
  | "status"
  | "cpu"
  | "memory"
  | "disk"
  | "created";

/** Fixed column widths; the table never renders a column partially. */
export const LIST_COLUMN_WIDTHS: Record<ListColumn, number> = {
  cursor: 2,
  name: 16,
  id: 13,
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
