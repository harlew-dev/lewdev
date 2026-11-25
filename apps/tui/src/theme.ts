export const colors = {
  background: "#0b0f14",
  panel: "#111923",
  panelAlt: "#0f1620",
  border: "#26384a",
  accent: "#63c9ff",
  accentSoft: "#1d3a4c",
  text: "#d7e2ed",
  muted: "#7c8b9b",
  success: "#5bd68a",
  warning: "#f0c95a",
  error: "#ff7b72",
  selection: "#17384d",
  white: "#f4f8fc",
} as const;

export function statusColor(status: string): string {
  switch (status) {
    case "started":
      return colors.success;
    case "creating":
    case "awaiting_runtime":
      return colors.accent;
    case "stopped":
    case "passivated":
      return colors.warning;
    case "error":
      return colors.error;
    default:
      return colors.muted;
  }
}
