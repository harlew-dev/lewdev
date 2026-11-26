import type { PortVisibility } from "@lewdev/core";

export type PortProtocol = "http" | "tcp";

export interface PortProtocolOption {
  value: PortProtocol;
  label: string;
  description: string;
}

export interface PortVisibilityOption {
  value: PortVisibility;
  label: string;
  description: string;
}

const HTTP_PROTOCOL_OPTION: PortProtocolOption = {
  value: "http",
  label: "HTTP(S)",
  description: "Open an HTTP(S) URL through the AerolVM gateway.",
};

const TCP_PROTOCOL_OPTION: PortProtocolOption = {
  value: "tcp",
  label: "TCP",
  description: "Open a raw TCP port that clients reach as a host and port.",
};

export const PORT_PROTOCOL_OPTIONS: PortProtocolOption[] = [
  HTTP_PROTOCOL_OPTION,
  TCP_PROTOCOL_OPTION,
];

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

export function protocolOption(value: PortProtocol): PortProtocolOption {
  return value === "tcp" ? TCP_PROTOCOL_OPTION : HTTP_PROTOCOL_OPTION;
}

export function protocolLabel(value: PortProtocol): string {
  return protocolOption(value).label;
}

export function visibilityOption(value: PortVisibility): PortVisibilityOption {
  return value === "token" ? PRIVATE_OPTION : PUBLIC_OPTION;
}

export function visibilityLabel(value: PortVisibility): string {
  return visibilityOption(value).label;
}

export function visibilityTableLabel(value: PortVisibility | undefined): string {
  return value === "token" ? "private" : "public";
}

/** The address clients dial: `host:hostPort` for TCP, otherwise the URL. */
export function portAddress(port: { url: string; host?: string; hostPort?: number }): string {
  return port.host !== undefined && port.hostPort !== undefined
    ? `${port.host}:${port.hostPort}`
    : port.url;
}

/** The visibility/type column: TCP for raw ports, otherwise public/private. */
export function portTypeLabel(port: {
  protocol?: "http" | "tcp" | "tls";
  visibility?: PortVisibility;
}): string {
  return port.protocol === "tcp" ? "TCP" : visibilityTableLabel(port.visibility);
}
