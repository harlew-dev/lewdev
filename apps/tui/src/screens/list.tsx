import type { SandboxInfo } from "@lewdev/core";
import { useTerminalDimensions } from "@opentui/react";

import { StatusText } from "../components";
import {
  formatAge,
  formatCpu,
  formatDisk,
  formatMemory,
  runtimeLabel,
  sandboxLabel,
  shortId,
  shortStatus,
  truncate,
} from "../format";
import { LIST_COLUMN_WIDTHS, visibleListColumns } from "../list-columns";
import { sortLabel, type SortMode } from "../list-view";
import { colors } from "../theme";

interface ListScreenProps {
  sandboxes: SandboxInfo[];
  /** Unfiltered count, shown as "3 of 10" while a filter is active. */
  totalCount: number;
  selected: number;
  filter: string;
  filterEditing: boolean;
  sort: SortMode;
  loading: boolean;
  error: string | null;
}

const WIDTHS = LIST_COLUMN_WIDTHS;
/** Root padding, card borders and card padding around the table. */
const CARD_CHROME = 6;

export function ListScreen({
  sandboxes,
  totalCount,
  selected,
  filter,
  filterEditing,
  sort,
  loading,
  error,
}: ListScreenProps) {
  const { width, height } = useTerminalDimensions();
  const innerWidth = Math.max(0, width - CARD_CHROME);
  const columns = visibleListColumns(innerWidth);
  const show = (column: (typeof columns)[number]) => columns.includes(column);
  const filterVisible = filterEditing || filter.length > 0;
  // Leave room for the tab bar, card borders, the table header, the separator,
  // the New sandbox button, the footer, the usage bar and the page chrome so
  // the button is never pushed out. The filter row takes two more lines.
  const visibleRows = Math.max(1, height - 19 - (filterVisible ? 2 : 0));
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(visibleRows / 2), sandboxes.length - visibleRows),
  );
  const visible = sandboxes.slice(start, start + visibleRows);
  const newSelected = selected >= sandboxes.length;
  const query = filter.trim();
  const title = query
    ? `Sandboxes (${sandboxes.length} of ${totalCount}) · ${sortLabel(sort)}`
    : `Sandboxes (${totalCount}) · ${sortLabel(sort)}`;

  return (
    <box flexDirection="column" flexGrow={1}>
      <box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        overflow="hidden"
        border
        borderStyle="rounded"
        borderColor={colors.border}
        backgroundColor={colors.panel}
        title={title}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}

        {filterEditing || filter.length > 0 ? (
          <box
            flexDirection="row"
            flexShrink={0}
            paddingLeft={1}
            paddingRight={1}
            paddingBottom={1}
          >
            <text fg={colors.muted}>Filter: </text>
            <text fg={filter.length > 0 ? colors.text : colors.muted}>
              {filter.length > 0 ? filter : "type to filter"}
            </text>
            {filterEditing ? <text fg={colors.accent}>▌</text> : null}
          </box>
        ) : null}

        <box flexDirection="column" flexShrink={0}>
          <box flexDirection="row" flexShrink={0} paddingLeft={1}>
            <box width={WIDTHS.cursor}>
              <text> </text>
            </box>
            <box width={WIDTHS.name}>
              <text fg={colors.muted}>NAME</text>
            </box>
            {show("id") ? (
              <box width={WIDTHS.id}>
                <text fg={colors.muted}>ID</text>
              </box>
            ) : null}
            <box width={WIDTHS.image}>
              <text fg={colors.muted}>IMAGE</text>
            </box>
            <box width={WIDTHS.status}>
              <text fg={colors.muted}>STATUS</text>
            </box>
            {show("runtime") ? (
              <box width={WIDTHS.runtime}>
                <text fg={colors.muted}>RUNTIME</text>
              </box>
            ) : null}
            <box width={WIDTHS.cpu}>
              <text fg={colors.muted}>CPU</text>
            </box>
            <box width={WIDTHS.memory}>
              <text fg={colors.muted}>MEMORY</text>
            </box>
            {show("disk") ? (
              <box width={WIDTHS.disk}>
                <text fg={colors.muted}>DISK</text>
              </box>
            ) : null}
            {show("created") ? (
              <box width={WIDTHS.created}>
                <text fg={colors.muted}>CREATED</text>
              </box>
            ) : null}
            <box flexGrow={1} />
          </box>

          {loading && totalCount === 0 ? (
            <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
              Loading sandboxes…
            </text>
          ) : null}

          {!loading && !query && totalCount === 0 ? (
            <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
              <text fg={colors.text}>No sandboxes yet.</text>
              <text fg={colors.muted} wrapMode="word">
                Press n to create one, or 2 for Snapshots to boot from a snapshot.
              </text>
            </box>
          ) : null}

          {!loading && query && sandboxes.length === 0 ? (
            <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
              <text fg={colors.text}>No sandboxes match "{query}"</text>
              <text fg={colors.muted}>Esc clears the filter</text>
            </box>
          ) : null}

          {visible.map((sandbox, index) => {
            const absoluteIndex = start + index;
            const isSelected = absoluteIndex === selected;
            return (
              <box
                key={sandbox.id}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={WIDTHS.name}>
                  <text fg={sandbox.name ? colors.text : colors.muted}>
                    {truncate(sandboxLabel(sandbox), WIDTHS.name - 1)}
                  </text>
                </box>
                {show("id") ? (
                  <box width={WIDTHS.id}>
                    <text fg={colors.muted}>{shortId(sandbox.id)}</text>
                  </box>
                ) : null}
                <box width={WIDTHS.image}>
                  <text fg={colors.text}>{truncate(sandbox.image, WIDTHS.image - 1)}</text>
                </box>
                <box width={WIDTHS.status}>
                  <StatusText status={sandbox.status} label={shortStatus(sandbox.status)} />
                </box>
                {show("runtime") ? (
                  <box width={WIDTHS.runtime}>
                    <text fg={sandbox.runtime ? colors.text : colors.muted}>
                      {truncate(runtimeLabel(sandbox.runtime), WIDTHS.runtime - 1)}
                    </text>
                  </box>
                ) : null}
                <box width={WIDTHS.cpu}>
                  <text fg={colors.muted}>{formatCpu(sandbox.cpu)}</text>
                </box>
                <box width={WIDTHS.memory}>
                  <text fg={colors.muted}>{formatMemory(sandbox.memoryMB)}</text>
                </box>
                {show("disk") ? (
                  <box width={WIDTHS.disk}>
                    <text fg={colors.muted}>{formatDisk(sandbox.diskGB)}</text>
                  </box>
                ) : null}
                {show("created") ? (
                  <box width={WIDTHS.created}>
                    <text fg={colors.muted}>{formatAge(sandbox.createdAt)}</text>
                  </box>
                ) : null}
                <box flexGrow={1} />
              </box>
            );
          })}
        </box>

        <box height={1} flexShrink={0} />
        <box
          flexDirection="row"
          flexShrink={0}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={newSelected ? colors.selection : colors.panelAlt}
        >
          <text fg={newSelected ? colors.accent : colors.text}>+ New sandbox</text>
        </box>
      </box>
    </box>
  );
}
