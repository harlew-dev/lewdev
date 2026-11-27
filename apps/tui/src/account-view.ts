import {
  API_TOKEN_ROLES,
  type AccountInfo,
  type ApiTokenInfo,
  type ApiTokenRole,
  type ConfigSource,
  type CreateApiTokenInput,
  normalizeApiUrl,
  type ProfileSummary,
} from "@lewdev/core";

export type TokenExpiryPreset = "30d" | "90d" | "365d" | "custom";

export const TOKEN_EXPIRY_PRESETS: ReadonlyArray<{ id: TokenExpiryPreset; label: string }> = [
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "365d", label: "365d" },
  { id: "custom", label: "custom" },
];

export const TOKEN_ROLE_LABELS: Record<ApiTokenRole, string> = {
  viewer: "viewer",
  runner: "runner",
  auditor: "auditor",
  admin: "admin",
};

export const TOKEN_ROLE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = API_TOKEN_ROLES.map(
  (role) => ({ id: role, label: TOKEN_ROLE_LABELS[role] }),
);

export interface TokenFormValues {
  name: string;
  role: ApiTokenRole;
  team: string;
  expiry: TokenExpiryPreset;
  customExpiry: string;
}

export type TokenFormField = "name" | "role" | "team" | "expiry" | "custom-expiry" | "submit";

export function defaultTokenTeam(role: ApiTokenRole, callerTeam?: string): string {
  if (role === "auditor" || role === "admin") {
    return "*";
  }
  return callerTeam?.trim() ?? "";
}

export function defaultTokenForm(account: AccountInfo | null): TokenFormValues {
  return {
    name: "",
    role: "viewer",
    team: defaultTokenTeam("viewer", account?.team),
    expiry: "30d",
    customExpiry: "90d",
  };
}

export function tokenFormFields(values: TokenFormValues): [TokenFormField, ...TokenFormField[]] {
  return [
    "name",
    "role",
    "team",
    "expiry",
    ...(values.expiry === "custom" ? (["custom-expiry"] as const) : []),
    "submit",
  ];
}

export function nextTokenFormField(
  values: TokenFormValues,
  current: TokenFormField,
  delta: number,
): TokenFormField {
  const fields = tokenFormFields(values);
  const index = Math.max(fields.indexOf(current), 0);
  const next = (index + delta + fields.length) % fields.length;
  return fields[next] ?? fields[0];
}

export function tokenFormInput(values: TokenFormValues): CreateApiTokenInput {
  return {
    name: values.name,
    role: values.role,
    team: values.team,
    expiresIn: values.expiry === "custom" ? values.customExpiry : values.expiry,
  };
}

export function canListApiTokens(role: string | undefined): boolean {
  return role === "auditor" || role === "admin";
}

export function canManageApiTokens(role: string | undefined): boolean {
  return role === "admin";
}

/** Why the API token list or its write actions are unavailable for a role. */
export function tokenAccessNote(role: string | undefined): string | null {
  if (role === undefined) {
    return "The account role is still loading.";
  }
  if (role === "auditor") {
    return "Creating and revoking tokens needs the admin role.";
  }
  if (!canListApiTokens(role)) {
    return "The API token list needs the auditor or admin role.";
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A warning when a credential expires within a week, including already expired. */
export function tokenExpiryWarning(expiresAt: string | undefined, now = Date.now()): string | null {
  if (!expiresAt) {
    return null;
  }
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const remaining = timestamp - now;
  if (remaining <= 0) {
    return "This token has expired.";
  }
  if (remaining <= 7 * DAY_MS) {
    const days = Math.max(1, Math.ceil(remaining / DAY_MS));
    return `This token expires in ${days} ${days === 1 ? "day" : "days"}.`;
  }
  return null;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * A safe default profile name from an API URL: the first hostname label,
 * normalised to the profile-name rules. Empty when no useful name remains.
 */
export function profileNameFromUrl(apiUrl: string): string {
  let host: string;
  try {
    host = new URL(normalizeApiUrl(apiUrl)).hostname.toLowerCase();
  } catch {
    return "";
  }
  const first = host.split(".")[0] ?? "";
  const candidates = [first, host];
  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[^a-z0-9]+/, "")
      .replace(/-+$/, "")
      .slice(0, 32);
    if (/^[a-z0-9][a-z0-9_-]{0,31}$/.test(cleaned)) {
      return cleaned;
    }
  }
  return "";
}

/**
 * Why profiles cannot be changed while environment variables override the
 * server. Names the variables that are actually set.
 */
export function profileBlockReason(
  source: ConfigSource | null,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (source !== "env" && source !== "mixed") {
    return null;
  }
  const names: string[] = [];
  if (env.SB_API_URL?.trim()) {
    names.push("SB_API_URL");
  }
  if (env.SB_API_TOKEN?.trim()) {
    names.push("SB_API_TOKEN");
  }
  const label = names.length > 0 ? names.join(" and ") : "SB_API_URL and SB_API_TOKEN";
  const pronoun = names.length === 1 ? "it" : "them";
  return `The server is set by ${label}. Unset ${pronoun} to change profiles.`;
}

export interface AccountRowSelection {
  profile: ProfileSummary | null;
  token: ApiTokenInfo | null;
  index: number;
}

/** Maps one cursor over the profile rows and then the token rows. */
export function accountRowSelection(
  profiles: ProfileSummary[],
  tokens: ApiTokenInfo[],
  row: number,
): AccountRowSelection {
  const count = profiles.length + tokens.length;
  if (count === 0) {
    return { profile: null, token: null, index: 0 };
  }
  const index = Math.max(0, Math.min(row, count - 1));
  if (index < profiles.length) {
    return { profile: profiles[index] ?? null, token: null, index };
  }
  return { profile: null, token: tokens[index - profiles.length] ?? null, index };
}
