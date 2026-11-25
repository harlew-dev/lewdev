import type { PortVisibility } from "@lewdev/core";

export interface PortVisibilityOption {
  value: PortVisibility;
  label: string;
  description: string;
}

const PUBLIC_OPTION: PortVisibilityOption = {
  value: "public",
  label: "Public",
  description: "Anyone with the URL can reach this port.",
};

const PRIVATE_OPTION: PortVisibilityOption = {
  value: "token",
  label: "Private",
  description: "Needs a sandbox token for this port.",
};

export const PORT_VISIBILITY_OPTIONS: PortVisibilityOption[] = [PUBLIC_OPTION, PRIVATE_OPTION];

export function visibilityOption(value: PortVisibility): PortVisibilityOption {
  return value === "token" ? PRIVATE_OPTION : PUBLIC_OPTION;
}

export function visibilityLabel(value: PortVisibility): string {
  return visibilityOption(value).label;
}

export function visibilityTableLabel(value: PortVisibility | undefined): string {
  return value === "token" ? "private" : "public";
}
