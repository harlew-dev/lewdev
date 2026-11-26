/**
 * Pure helpers for the sandbox's POSIX paths. They must not use the host's
 * path module: lewdev may run on Windows while the sandbox is Linux.
 */

function segments(path: string): string[] {
  return path.replaceAll("\\", "/").split("/");
}

/** Collapses `//`, `.` and `..`; the result always starts with `/`. */
export function normalizeRemotePath(path: string): string {
  const parts: string[] = [];
  for (const segment of segments(path)) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return `/${parts.join("/")}`;
}

/** Resolves a typed path against a folder; `~` and `~/…` mean /root. */
export function resolveRemotePath(current: string, input: string): string {
  const value = input.trim();
  if (!value) {
    return normalizeRemotePath(current);
  }
  if (value === "~") {
    return "/root";
  }
  if (value.startsWith("~/")) {
    return normalizeRemotePath(`/root/${value.slice(2)}`);
  }
  if (value.startsWith("/")) {
    return normalizeRemotePath(value);
  }
  return normalizeRemotePath(`${normalizeRemotePath(current)}/${value}`);
}

export function parentRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path);
  if (normalized === "/") {
    return "/";
  }
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function joinRemotePath(parent: string, name: string): string {
  return normalizeRemotePath(`${normalizeRemotePath(parent)}/${name}`);
}

export function remoteBaseName(path: string): string {
  const normalized = normalizeRemotePath(path);
  if (normalized === "/") {
    return "/";
  }
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function isHiddenRemoteName(name: string): boolean {
  return name.startsWith(".") && name !== "." && name !== "..";
}

function longestCommonPrefix(values: string[]): string {
  const first = values[0] ?? "";
  let end = first.length;
  for (const value of values.slice(1)) {
    let index = 0;
    while (index < end && index < value.length && value[index] === first[index]) {
      index += 1;
    }
    end = index;
  }
  return first.slice(0, end);
}

/**
 * Completes the last segment of a typed path from folder names. Returns the
 * input unchanged when nothing matches, and the common prefix when several do.
 */
export function completeRemotePath(input: string, folderNames: string[]): string {
  const slash = input.lastIndexOf("/");
  const directory = slash < 0 ? "" : input.slice(0, slash + 1);
  const partial = slash < 0 ? input : input.slice(slash + 1);
  const matches = [...new Set(folderNames)]
    .filter((name) => name.startsWith(partial))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (matches.length === 0) {
    return input;
  }
  const completion = matches.length === 1 ? (matches[0] ?? "") : longestCommonPrefix(matches);
  return `${directory}${completion}`;
}

/** Percent-encodes each segment but keeps the leading slash. */
export function remotePathForUrl(path: string): string {
  return normalizeRemotePath(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
