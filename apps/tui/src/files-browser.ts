import type { SandboxFileEntry } from "@lewdev/core";
import { describeFileError, joinRemotePath, resolveRemotePath } from "@lewdev/core";

import type { ActionHint } from "./actions";
import { formatAge } from "./format";

export type FilesMode =
  | "browse"
  | "path"
  | "upload"
  | "download"
  | "delete"
  | "rename"
  | "mkdir"
  | "search"
  | "search-results"
  | "conflict";

export type FilesSearchKind = "name" | "text";

export interface FilesSearchResult {
  path: string;
  line?: number;
  content?: string;
}

export type FilesPending =
  | { kind: "download"; remotePath: string; folder: string; localPath: string }
  | { kind: "upload"; localPath: string; remotePath: string; isDir: boolean }
  | { kind: "rename"; source: string; destination: string };

export interface FilesState {
  dir: string;
  entries: SandboxFileEntry[];
  truncated: boolean;
  loading: boolean;
  error: string | null;
  selected: number;
  filter: string;
  filterEditing: boolean;
  mode: FilesMode;
  /** The active prompt's text. */
  input: string;
  inputError: string | null;
  /** The sandbox path a download, rename or delete prompt acts on. */
  targetPath: string | null;
  searchKind: FilesSearchKind;
  results: FilesSearchResult[];
  resultsSelected: number;
  resultsQuery: string;
  pending: FilesPending | null;
  conflictSelected: number;
  deleteTarget: SandboxFileEntry | null;
}

export interface FilesConflictOption {
  id: "overwrite" | "keep-both" | "cancel";
  label: string;
  description: string;
  tone?: "error";
}

export function initialFilesState(dir = "/root"): FilesState {
  return {
    dir,
    entries: [],
    truncated: false,
    loading: false,
    error: null,
    selected: 0,
    filter: "",
    filterEditing: false,
    mode: "browse",
    input: "",
    inputError: null,
    targetPath: null,
    searchKind: "name",
    results: [],
    resultsSelected: 0,
    resultsQuery: "",
    pending: null,
    conflictSelected: 0,
    deleteTarget: null,
  };
}

/** Folders first, then names in case-insensitive order. */
export function sortFileEntries(entries: readonly SandboxFileEntry[]): SandboxFileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    const primary = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    return primary !== 0 ? primary : a.name.localeCompare(b.name);
  });
}

/** Case-insensitive substring filter over the visible names. */
export function filterFileEntries(
  entries: readonly SandboxFileEntry[],
  query: string,
): SandboxFileEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return [...entries];
  }
  return entries.filter((entry) => entry.name.toLocaleLowerCase().includes(needle));
}

/** Applies the name filter, then folder-first sorting. */
export function visibleFileEntries(
  entries: readonly SandboxFileEntry[],
  query: string,
): SandboxFileEntry[] {
  return sortFileEntries(filterFileEntries(entries, query));
}

export function clampFilesSelection(selected: number, count: number): number {
  return count <= 0 ? 0 : Math.min(Math.max(selected, 0), count - 1);
}

/** Moves within the list without wrapping. */
export function moveFilesSelection(selected: number, delta: number, count: number): number {
  return clampFilesSelection(selected + delta, count);
}

/** The upload target for a local file or folder: `<dir>/<name>`. */
export function filesUploadTarget(dir: string, sourceName: string): string {
  return joinRemotePath(dir, sourceName);
}

/** Resolves a typed sandbox path against the current folder; `~` means /root. */
export function filesPathForInput(dir: string, input: string): string {
  return resolveRemotePath(dir, input);
}

/** True while a text field owns the keyboard. */
export function filesTextInputActive(state: FilesState): boolean {
  if (state.filterEditing) {
    return true;
  }
  return (
    state.mode === "path" ||
    state.mode === "upload" ||
    state.mode === "download" ||
    state.mode === "rename" ||
    state.mode === "mkdir" ||
    state.mode === "search"
  );
}

export function filesConflictOptions(pending: FilesPending | null): FilesConflictOption[] {
  const overwrite: FilesConflictOption =
    pending?.kind === "upload" && pending.isDir
      ? {
          id: "overwrite",
          label: "Overwrite / merge folder",
          description: "Replace matching files and keep the others.",
          tone: "error",
        }
      : {
          id: "overwrite",
          label: "Overwrite",
          description: "Replace what is there now; this cannot be undone.",
          tone: "error",
        };
  const keepBoth: FilesConflictOption = {
    id: "keep-both",
    label: "Keep both",
    description: 'Save as a copy with " (1)" after the name.',
  };
  const cancel: FilesConflictOption = {
    id: "cancel",
    label: "Cancel",
    description: "Leave both sides unchanged.",
  };
  // The safe choice comes first so a reflexive Enter never replaces anything.
  return pending?.kind === "download" ? [keepBoth, overwrite, cancel] : [cancel, overwrite];
}

export function filesHints(state: FilesState): ActionHint[] {
  switch (state.mode) {
    case "browse":
      if (state.filterEditing) {
        return [
          ["enter", "done"],
          ["esc", "clear filter"],
        ];
      }
      return [
        ["↑/↓", "move"],
        ["enter", "open folder"],
        ["backspace", "up"],
        ["g", "go to path"],
        ["/", "filter"],
        ["u", "upload"],
        ["d", "download"],
        ["r", "rename"],
        ["x", "delete"],
        ["n", "new folder"],
        ["s", "search"],
        ["esc", "back"],
      ];
    case "search":
      return [
        ["enter", "search"],
        ["tab", "name / text"],
        ["esc", "cancel"],
      ];
    case "delete":
      return [
        ["enter", "delete"],
        ["esc", "cancel"],
      ];
    case "conflict":
      return [
        ["↑/↓", "option"],
        ["enter", "choose"],
        ["esc", "cancel"],
      ];
    case "search-results":
      return [
        ["↑/↓", "move"],
        ["enter", "open result"],
        ["esc", "back"],
      ];
    default:
      return [
        ["enter", "submit"],
        ["esc", "cancel"],
      ];
  }
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`;
}

/** Compact age for the MODIFIED column; a dash when the API omits the time. */
export function formatFileTime(iso: string | undefined): string {
  if (iso === undefined) {
    return "—";
  }
  const age = formatAge(iso);
  return age === "—" ? age : `${age} ago`;
}

/** A search result's path, with the line number for text matches. */
export function searchResultLabel(result: FilesSearchResult): string {
  return result.line === undefined ? result.path : `${result.path}:${result.line}`;
}

/**
 * The glob sent to the server's name search. Plain text means "name contains",
 * so `report` finds `report.txt`; text with `*`, `?` or `[` is used as typed.
 */
export function nameSearchPattern(query: string): string {
  const trimmed = query.trim();
  return /[*?[]/.test(trimmed) ? trimmed : `*${trimmed}*`;
}

/**
 * Search errors in plain words. The server's text search gives up on files
 * with very long lines (minified code, for example) with a raw Go error.
 */
export function describeSearchError(error: unknown): string {
  const message = describeFileError(error);
  return /token too long/i.test(message)
    ? "The server could not search a file with very long lines here. Search a smaller folder, such as your project's source folder."
    : message;
}
