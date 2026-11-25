export function shortId(id: string): string {
  return id.length > 11 ? id.slice(0, 11) : id;
}

export function sandboxLabel(sandbox: { id: string; name?: string }): string {
  return sandbox.name && sandbox.name.length > 0 ? sandbox.name : shortId(sandbox.id);
}

export function truncate(value: string, max: number): string {
  const chars = [...value];
  if (chars.length <= max) {
    return value;
  }
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

export function formatAge(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCpu(cpu: number): string {
  return `${cpu} vCPU`;
}

export function formatMemory(memoryMB: number): string {
  if (memoryMB >= 1024) {
    const gb = memoryMB / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${memoryMB} MB`;
}

export function formatDisk(diskGB: number): string {
  return `${diskGB} GB`;
}

/** Display label for a sandbox status; the API's raw values stay untouched elsewhere. */
export function shortStatus(status: string): string {
  switch (status) {
    case "started":
      return "running";
    case "awaiting_runtime":
      return "awaiting";
    default:
      return status;
  }
}

export function safeHost(apiUrl: string): string {
  try {
    return new URL(apiUrl).host;
  } catch {
    return apiUrl;
  }
}

export function maskValue(value: string): string {
  return "•".repeat(Math.min([...value].length, 48));
}
