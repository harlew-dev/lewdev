import type { CustomDomainStatus } from "@lewdev/core";

/** Fields on the Add custom domain form, in tab order. */
export type CustomDomainField = "hostname" | "port" | "submit";

export interface CustomDomainFormValues {
  hostname: string;
  port: string;
}

export const CUSTOM_DOMAIN_DEFAULT: CustomDomainFormValues = { hostname: "", port: "" };

export const CUSTOM_DOMAIN_FIELDS: [CustomDomainField, ...CustomDomainField[]] = [
  "hostname",
  "port",
  "submit",
];

const CUSTOM_DOMAIN_STATUS_LABELS: Record<CustomDomainStatus, string> = {
  pending_dns: "Waiting for DNS",
  issuing: "Issuing certificate",
  ready: "Ready",
  failed: "Failed",
};

export function customDomainStatusLabel(status: CustomDomainStatus): string {
  return CUSTOM_DOMAIN_STATUS_LABELS[status] ?? status;
}

/** Where traffic to a custom hostname goes; `0` or missing is the toolbox port. */
export function customDomainTargetLabel(targetPort?: number): string {
  if (targetPort === undefined || targetPort === 0) {
    return "Toolbox port (default)";
  }
  return `Port ${targetPort}`;
}

export interface CustomDomainInput {
  hostname: string;
  port?: number;
}

/** Trims and validates the form; throws a message suitable for the form. */
export function customDomainInput(values: CustomDomainFormValues): CustomDomainInput {
  const hostname = values.hostname.trim();
  if (!hostname) {
    throw new Error("Enter a hostname, such as api.example.com.");
  }
  const rawPort = values.port.trim();
  if (!rawPort) {
    return { hostname };
  }
  if (!/^\d+$/.test(rawPort)) {
    throw new Error("Port must be a whole number from 1 to 65535, or empty for the default.");
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be a whole number from 1 to 65535, or empty for the default.");
  }
  return { hostname, port };
}
