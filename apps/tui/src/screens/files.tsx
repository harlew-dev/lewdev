import type { SandboxFileEntry } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Field, Panel } from "../components";
import type { FilesState } from "../files-browser";
import { filesConflictOptions, formatFileSize, formatFileTime } from "../files-browser";
import { truncate } from "../format";
import { colors } from "../theme";

interface FilesScreenProps {
  state: FilesState;
  /** The current listing after the name filter and folder-first sorting. */
  entries: SandboxFileEntry[];
}

const WIDTHS = {
  cursor: 2,
  size: 9,
  modified: 11,
  line: 7,
} as const;
/** Root padding, card borders, card padding and the row cursor inset. */
const ROW_CHROME = 8;

function BrowseScreen({ state, entries }: FilesScreenProps) {
  const { width } = useTerminalDimensions();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const nameWidth = Math.max(12, width - ROW_CHROME - WIDTHS.size - WIDTHS.modified);
  const filterVisible = state.filterEditing || state.filter.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`files-row-${state.selected}`, { align: "nearest" });
  }, [state.selected]);

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
        title={`Files · ${state.dir}`}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <box flexDirection="row" flexShrink={0} paddingLeft={1} paddingRight={1}>
          <text fg={colors.muted}>PATH </text>
          <text fg={colors.text} wrapMode="none">
            {state.dir}
          </text>
        </box>

        {filterVisible ? (
          <box flexDirection="row" flexShrink={0} paddingLeft={1} paddingRight={1} paddingTop={1}>
            <text fg={colors.muted}>Filter: </text>
            <text fg={state.filter.length > 0 ? colors.text : colors.muted}>
              {state.filter.length > 0 ? state.filter : "type to filter"}
            </text>
            {state.filterEditing ? <text fg={colors.accent}>▌</text> : null}
          </box>
        ) : null}

        {state.error ? (
          <text fg={colors.error} wrapMode="word" paddingLeft={1} paddingTop={1}>
            {state.error}
          </text>
        ) : null}

        {state.truncated ? (
          <text fg={colors.warning} wrapMode="word" paddingLeft={1} paddingTop={1}>
            The folder listing was truncated; only the first 2000 entries are shown.
          </text>
        ) : null}

        <box flexDirection="row" flexShrink={0} paddingLeft={1} paddingTop={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={nameWidth}>
            <text fg={colors.muted}>NAME</text>
          </box>
          <box width={WIDTHS.size}>
            <text fg={colors.muted}>SIZE</text>
          </box>
          <box width={WIDTHS.modified}>
            <text fg={colors.muted}>MODIFIED</text>
          </box>
          <box flexGrow={1} />
        </box>

        {state.loading && state.entries.length === 0 ? (
          <text fg={colors.muted} paddingLeft={1} paddingTop={1}>
            Loading folder…
          </text>
        ) : null}

        {!state.loading && !state.error && entries.length === 0 ? (
          <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingTop={1}>
            <text fg={colors.text}>
              {state.filter.length > 0
                ? `No files match "${state.filter}"`
                : "This folder is empty."}
            </text>
            <text fg={colors.muted}>
              {state.filter.length > 0 ? "Esc clears the filter." : "Press u to upload a file."}
            </text>
          </box>
        ) : null}

        <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} minHeight={0} scrollY>
          {entries.map((entry, index) => {
            const isSelected = index === state.selected;
            const arrow = entry.symlinkTarget ? ` → ${entry.symlinkTarget}` : "";
            const label = `${entry.isDir ? `${entry.name}/` : entry.name}${arrow}`;
            return (
              <box
                key={entry.path}
                id={`files-row-${index}`}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{isSelected ? "›" : " "}</text>
                </box>
                <box width={nameWidth}>
                  <text
                    fg={isSelected ? colors.accent : entry.isDir ? colors.accent : colors.text}
                    wrapMode="none"
                  >
                    {truncate(label, nameWidth - 1)}
                  </text>
                </box>
                <box width={WIDTHS.size}>
                  <text fg={colors.muted}>
                    {formatFileSize(entry.isDir ? undefined : entry.size)}
                  </text>
                </box>
                <box width={WIDTHS.modified}>
                  <text fg={colors.muted}>{formatFileTime(entry.modTime)}</text>
                </box>
                <box flexGrow={1} />
              </box>
            );
          })}
        </scrollbox>
      </box>
    </box>
  );
}

function PromptScreen({
  title,
  label,
  placeholder,
  value,
  error,
  children,
}: {
  title: string;
  label: string;
  placeholder?: string;
  value: string;
  error: string | null;
  children?: ReactNode;
}) {
  return (
    <Panel title={title} width={82}>
      {children}
      <Field label={label} value={value} active placeholder={placeholder} />
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
    </Panel>
  );
}

function DeleteScreen({ state }: { state: FilesState }) {
  const target = state.deleteTarget;
  return (
    <Panel title="Delete" width={82}>
      <text fg={colors.text} wrapMode="word">
        Delete {target?.path ?? state.targetPath ?? "this item"}?
      </text>
      {target?.isDir ? (
        <text fg={colors.error} wrapMode="word">
          This deletes the folder and everything inside it. This cannot be undone.
        </text>
      ) : (
        <text fg={colors.muted} wrapMode="word">
          This cannot be undone.
        </text>
      )}
      {state.inputError ? (
        <text fg={colors.error} wrapMode="word">
          {state.inputError}
        </text>
      ) : null}
    </Panel>
  );
}

function ConflictScreen({ state }: { state: FilesState }) {
  const options = filesConflictOptions(state.pending);
  const pending = state.pending;
  return (
    <Panel title="Already exists" width={82}>
      {pending?.kind === "download" ? (
        <box flexDirection="column" flexShrink={0}>
          <text fg={colors.text} wrapMode="word">
            {pending.localPath}
          </text>
          <text fg={colors.muted} wrapMode="word">
            already exists. Choose how to save {pending.remotePath}.
          </text>
        </box>
      ) : pending?.kind === "upload" ? (
        <box flexDirection="column" flexShrink={0}>
          <text fg={colors.text} wrapMode="word">
            {pending.remotePath}
          </text>
          <text fg={colors.muted} wrapMode="word">
            already exists in the sandbox.
          </text>
        </box>
      ) : (
        <box flexDirection="column" flexShrink={0}>
          <text fg={colors.text} wrapMode="word">
            {pending?.destination ?? "The destination"}
          </text>
          <text fg={colors.muted} wrapMode="word">
            already exists in the sandbox.
          </text>
        </box>
      )}
      <box flexDirection="column" flexShrink={0}>
        {options.map((option, index) => {
          const selected = index === state.conflictSelected;
          return (
            <box
              key={option.id}
              flexDirection="column"
              flexShrink={0}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selected ? colors.selection : undefined}
            >
              <box flexDirection="row" flexShrink={0}>
                <box width={2}>
                  <text fg={selected ? colors.accent : colors.muted}>{selected ? "›" : " "}</text>
                </box>
                <text
                  fg={
                    option.tone === "error" ? colors.error : selected ? colors.accent : colors.text
                  }
                >
                  {option.label}
                </text>
              </box>
              <box flexDirection="row" flexShrink={0}>
                <box width={2}>
                  <text> </text>
                </box>
                <text fg={colors.muted} wrapMode="word">
                  {option.description}
                </text>
              </box>
            </box>
          );
        })}
      </box>
      {state.inputError ? (
        <text fg={colors.error} wrapMode="word">
          {state.inputError}
        </text>
      ) : null}
    </Panel>
  );
}

function SearchResultsScreen({ state }: { state: FilesState }) {
  const { width } = useTerminalDimensions();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const pathWidth = Math.max(16, width - ROW_CHROME - WIDTHS.line - 24);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`files-result-${state.resultsSelected}`, {
      align: "nearest",
    });
  }, [state.resultsSelected]);

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
        title={`Search results (${state.results.length}) · ${state.resultsQuery}`}
        titleColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {state.error ? (
          <text fg={colors.error} wrapMode="word" paddingLeft={1}>
            {state.error}
          </text>
        ) : null}
        <box flexDirection="row" flexShrink={0} paddingLeft={1}>
          <box width={WIDTHS.cursor}>
            <text> </text>
          </box>
          <box width={pathWidth}>
            <text fg={colors.muted}>FILE</text>
          </box>
          <box width={WIDTHS.line}>
            <text fg={colors.muted}>LINE</text>
          </box>
          <box flexGrow={1}>
            <text fg={colors.muted}>MATCH</text>
          </box>
        </box>
        {!state.loading && state.results.length === 0 ? (
          <text fg={colors.text} paddingLeft={1} paddingTop={1}>
            No matches.
          </text>
        ) : null}
        <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} minHeight={0} scrollY>
          {state.results.map((result, index) => {
            const selected = index === state.resultsSelected;
            return (
              <box
                key={`${result.path}:${result.line ?? ""}:${result.content ?? ""}`}
                id={`files-result-${index}`}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                backgroundColor={selected ? colors.selection : undefined}
              >
                <box width={WIDTHS.cursor}>
                  <text fg={colors.accent}>{selected ? "›" : " "}</text>
                </box>
                <box width={pathWidth}>
                  <text fg={selected ? colors.accent : colors.text} wrapMode="none">
                    {truncate(result.path, pathWidth - 1)}
                  </text>
                </box>
                <box width={WIDTHS.line}>
                  <text fg={colors.muted}>{result.line === undefined ? "—" : result.line}</text>
                </box>
                <box flexGrow={1}>
                  <text fg={colors.muted} wrapMode="none">
                    {truncate(result.content ?? "", 23)}
                  </text>
                </box>
              </box>
            );
          })}
        </scrollbox>
      </box>
    </box>
  );
}

export function FilesScreen({ state, entries }: FilesScreenProps) {
  switch (state.mode) {
    case "browse":
      return <BrowseScreen state={state} entries={entries} />;
    case "path":
      return (
        <PromptScreen
          title="Go to path"
          label="Path"
          placeholder="/root or ~"
          value={state.input}
          error={state.inputError}
        >
          <text fg={colors.muted} wrapMode="word">
            Absolute paths start at the sandbox root; ~ means /root.
          </text>
        </PromptScreen>
      );
    case "upload":
      return (
        <PromptScreen
          title="Upload"
          label="Local file or folder"
          placeholder="~/path/to/file"
          value={state.input}
          error={state.inputError}
        >
          <text fg={colors.muted} wrapMode="word">
            The item is copied into {state.dir}. A folder appears as its own folder.
          </text>
        </PromptScreen>
      );
    case "download":
      return (
        <PromptScreen
          title="Download"
          label="Destination folder"
          placeholder="~/Downloads"
          value={state.input}
          error={state.inputError}
        >
          <text fg={colors.muted} wrapMode="word">
            Source: {state.targetPath ?? "the selected file"}
          </text>
          <text fg={colors.muted} wrapMode="word">
            Missing local folders are created.
          </text>
        </PromptScreen>
      );
    case "rename":
      return (
        <PromptScreen
          title="Rename or move"
          label="New path"
          placeholder="/root/new-name"
          value={state.input}
          error={state.inputError}
        >
          <text fg={colors.muted} wrapMode="word">
            From: {state.targetPath ?? "the selected item"}
          </text>
        </PromptScreen>
      );
    case "mkdir":
      return (
        <PromptScreen
          title="New folder"
          label="Name"
          placeholder="folder-name"
          value={state.input}
          error={state.inputError}
        >
          <text fg={colors.muted} wrapMode="word">
            The folder is created in {state.dir}.
          </text>
        </PromptScreen>
      );
    case "search":
      return (
        <Panel title="Search" width={82}>
          <text fg={colors.muted} wrapMode="word">
            Search {state.dir} by name or for text inside files. Tab switches mode.
          </text>
          <Field
            label={state.searchKind === "name" ? "Name pattern" : "Text to find"}
            value={state.input}
            active
            placeholder={state.searchKind === "name" ? "*.log" : "TODO"}
          />
          <text fg={colors.accent}>
            Mode: {state.searchKind === "name" ? "by name" : "text inside files"} (tab)
          </text>
          {state.inputError ? (
            <text fg={colors.error} wrapMode="word">
              {state.inputError}
            </text>
          ) : null}
        </Panel>
      );
    case "delete":
      return <DeleteScreen state={state} />;
    case "conflict":
      return <ConflictScreen state={state} />;
    case "search-results":
      return <SearchResultsScreen state={state} />;
  }
}
