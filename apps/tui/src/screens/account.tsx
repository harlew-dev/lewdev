import type {
  AccountInfo,
  ApiTokenInfo,
  ConfigSource,
  CreatedApiToken,
  ProfileSummary,
  UsageMetric,
  UsageSummary,
} from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import {
  shortDate,
  TOKEN_EXPIRY_PRESETS,
  TOKEN_ROLE_OPTIONS,
  type TokenFormField,
  type TokenFormValues,
  tokenExpiryWarning,
} from "../account-view";
import { Field, FormButton, Panel, SegmentedRow } from "../components";
import { truncate } from "../format";
import { colors } from "../theme";

const PROFILE_NAME_WIDTH = 20;
const TOKEN_NAME_WIDTH = 16;
const TOKEN_ID_WIDTH = 14;
const TOKEN_ROLE_WIDTH = 8;
const TOKEN_TEAM_WIDTH = 8;
const TOKEN_DATE_WIDTH = 10;

export interface AccountScreenProps {
  account: AccountInfo | null;
  accountError: string | null;
  usage: UsageSummary;
  source: ConfigSource | null;
  configUrl: string | null;
  activeProfile: string | null;
  profiles: ProfileSummary[];
  selectedRow: number;
  profileBlockedReason: string | null;
  tokens: ApiTokenInfo[];
  tokensLoading: boolean;
  tokensError: string | null;
  tokensVisible: boolean;
  tokensNote: string | null;
  canManageTokens: boolean;
  tokenForm: TokenFormValues | null;
  tokenFocus: TokenFormField;
  tokenFormError: string | null;
  tokenCreating: boolean;
  createdToken: CreatedApiToken | null;
  secretMode: "secret" | "save-profile";
  secretProfileName: string;
  secretError: string | null;
  deleteProfileName: string | null;
  revokeToken: ApiTokenInfo | null;
  revokeError: string | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <box flexDirection="column" flexShrink={0} gap={0}>
      <text fg={colors.accent}>{title}</text>
      {children}
    </box>
  );
}

function InfoRow({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <box width={16} flexShrink={0}>
        <text fg={colors.muted}>{label}</text>
      </box>
      <text fg={color} wrapMode="word">
        {value}
      </text>
    </box>
  );
}

function usageGigabytes(memoryMB: number): string {
  const gb = memoryMB / 1024;
  return Number.isInteger(gb) ? String(gb) : String(Number(gb.toFixed(1)));
}

function metricValue(metric: UsageMetric, format: (value: number) => string): string {
  return metric.limit === undefined
    ? format(metric.used)
    : `${format(metric.used)} / ${format(metric.limit)}`;
}

function metricColor(metric: UsageMetric): string {
  if (metric.level === "error") {
    return colors.error;
  }
  if (metric.level === "warning") {
    return colors.warning;
  }
  return colors.text;
}

function sourceLabel(source: ConfigSource | null): string {
  switch (source) {
    case "env":
      return "Environment variables";
    case "mixed":
      return "Environment variables and the config file";
    case "file":
      return "Config file";
    default:
      return "Not connected";
  }
}

function ProfileRow({ profile, selected }: { profile: ProfileSummary; selected: boolean }) {
  return (
    <box
      id={`account-profile-${profile.name}`}
      flexDirection="row"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={selected ? colors.selection : undefined}
    >
      <box width={2}>
        <text fg={selected ? colors.accent : colors.muted}>{selected ? "›" : " "}</text>
      </box>
      <box width={PROFILE_NAME_WIDTH} flexShrink={0}>
        <text fg={selected ? colors.accent : colors.text}>
          {truncate(profile.name, PROFILE_NAME_WIDTH)}
        </text>
      </box>
      <box flexGrow={1}>
        <text fg={colors.muted} wrapMode="none">
          {profile.apiUrl}
        </text>
      </box>
      {profile.active ? (
        <box flexShrink={0} paddingLeft={1}>
          <text fg={colors.success}>active</text>
        </box>
      ) : null}
    </box>
  );
}

function TokenRow({
  token,
  index,
  selected,
}: {
  token: ApiTokenInfo;
  index: number;
  selected: boolean;
}) {
  const expired = token.expired || Date.parse(token.expiresAt) <= Date.now();
  const color = expired ? colors.muted : colors.text;
  return (
    <box
      id={`account-token-row-${index}`}
      flexDirection="row"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={selected ? colors.selection : undefined}
    >
      <box width={2}>
        <text fg={selected ? colors.accent : colors.muted}>{selected ? "›" : " "}</text>
      </box>
      <box width={TOKEN_NAME_WIDTH} flexShrink={0}>
        <text fg={selected ? colors.accent : color}>{truncate(token.name, TOKEN_NAME_WIDTH)}</text>
      </box>
      <box width={TOKEN_ID_WIDTH} flexShrink={0}>
        <text fg={colors.muted}>{truncate(token.id, TOKEN_ID_WIDTH)}</text>
      </box>
      <box width={TOKEN_ROLE_WIDTH} flexShrink={0}>
        <text fg={color}>{truncate(token.role, TOKEN_ROLE_WIDTH)}</text>
      </box>
      <box width={TOKEN_TEAM_WIDTH} flexShrink={0}>
        <text fg={colors.muted}>{truncate(token.team, TOKEN_TEAM_WIDTH)}</text>
      </box>
      <box width={TOKEN_DATE_WIDTH} flexShrink={0}>
        <text fg={colors.muted}>{shortDate(token.createdAt)}</text>
      </box>
      <box width={TOKEN_DATE_WIDTH} flexShrink={0}>
        <text fg={expired ? colors.muted : colors.text}>
          {expired ? "expired" : shortDate(token.expiresAt)}
        </text>
      </box>
    </box>
  );
}

function TokenForm({
  values,
  focus,
  error,
  creating,
}: {
  values: TokenFormValues;
  focus: TokenFormField;
  error: string | null;
  creating: boolean;
}) {
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={colors.border}
      backgroundColor={colors.panelAlt}
      title="New API token"
      titleColor={colors.accent}
      flexDirection="column"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <box id="account-token-name">
        <Field
          label="Name"
          value={values.name}
          active={focus === "name"}
          placeholder="e.g. laptop"
        />
      </box>
      <box id="account-token-role">
        <SegmentedRow
          label="Role"
          options={TOKEN_ROLE_OPTIONS}
          selected={values.role}
          active={focus === "role"}
          labelWidth={12}
        />
      </box>
      <box id="account-token-team">
        <Field
          label="Team"
          value={values.team}
          active={focus === "team"}
          placeholder={values.role === "auditor" || values.role === "admin" ? "*" : "team name"}
        />
      </box>
      <box id="account-token-expiry">
        <SegmentedRow
          label="Expiry"
          options={TOKEN_EXPIRY_PRESETS}
          selected={values.expiry}
          active={focus === "expiry"}
          labelWidth={12}
        />
      </box>
      {values.expiry === "custom" ? (
        <box id="account-token-custom-expiry">
          <Field
            label="Custom expiry"
            value={values.customExpiry}
            active={focus === "custom-expiry"}
            placeholder="e.g. 45d or 720h"
          />
        </box>
      ) : null}
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <box id="account-token-submit">
        <FormButton label={creating ? "Creating…" : "Create token"} active={focus === "submit"} />
      </box>
    </box>
  );
}

function SecretPanel({
  created,
  mode,
  profileName,
  error,
  canSaveProfile,
}: {
  created: CreatedApiToken;
  mode: "secret" | "save-profile";
  profileName: string;
  error: string | null;
  canSaveProfile: boolean;
}) {
  return (
    <box
      id="account-secret"
      border
      borderStyle="rounded"
      borderColor={colors.warning}
      backgroundColor={colors.panelAlt}
      title="New token secret"
      titleColor={colors.warning}
      flexDirection="column"
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <text fg={colors.warning} wrapMode="word">
        Copy this secret now. AerolVM shows it only once.
      </text>
      <text fg={colors.text} selectable>
        {created.secret}
      </text>
      {mode === "save-profile" ? (
        <box id="account-secret-profile">
          <Field label="Profile name" value={profileName} active placeholder="e.g. eu-west" />
        </box>
      ) : null}
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <text fg={colors.muted}>
        {mode === "save-profile"
          ? "enter save · esc back"
          : canSaveProfile
            ? "c copy · s save as profile · esc done"
            : "c copy · esc done"}
      </text>
    </box>
  );
}

export function AccountScreen({
  account,
  accountError,
  usage,
  source,
  configUrl,
  activeProfile,
  profiles,
  selectedRow,
  profileBlockedReason,
  tokens,
  tokensLoading,
  tokensError,
  tokensVisible,
  tokensNote,
  canManageTokens,
  tokenForm,
  tokenFocus,
  tokenFormError,
  tokenCreating,
  createdToken,
  secretMode,
  secretProfileName,
  secretError,
  deleteProfileName,
  revokeToken,
  revokeError,
}: AccountScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const selectedProfileIndex = selectedRow >= 0 && selectedRow < profiles.length ? selectedRow : -1;
  const selectedTokenIndex =
    selectedRow >= profiles.length && selectedRow < profiles.length + tokens.length
      ? selectedRow - profiles.length
      : -1;
  const expiryWarning = tokenExpiryWarning(account?.expiresAt);
  const selectedId = tokenForm
    ? `account-token-${tokenFocus}`
    : createdToken
      ? "account-secret"
      : deleteProfileName
        ? "account-delete-profile"
        : revokeToken
          ? "account-revoke-token"
          : selectedProfileIndex >= 0
            ? `account-profile-${profiles[selectedProfileIndex]?.name ?? ""}`
            : selectedTokenIndex >= 0
              ? `account-token-row-${selectedTokenIndex}`
              : "account-identity";

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(selectedId, { align: "nearest" });
  }, [selectedId]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <box width="100%" alignItems="center" paddingTop={1} paddingBottom={1}>
        <box
          width={92}
          maxWidth="100%"
          border
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.panel}
          title="Account"
          titleColor={colors.accent}
          flexDirection="column"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          gap={2}
        >
          <box id="account-identity" flexDirection="column" flexShrink={0} gap={1}>
            <Section title="Identity">
              {account ? (
                <>
                  <InfoRow label="Role" value={account.role} />
                  <InfoRow label="Team" value={account.team ?? "—"} />
                  <InfoRow label="Principal" value={account.principalName ?? "—"} />
                  <InfoRow label="Kind" value={account.principalKind ?? "—"} />
                  <InfoRow
                    label="Token expires"
                    value={
                      account.expiresAt
                        ? shortDate(account.expiresAt)
                        : "No expiry reported by the server"
                    }
                    color={expiryWarning ? colors.warning : colors.text}
                  />
                  {expiryWarning ? (
                    <text fg={colors.warning} wrapMode="word">
                      {expiryWarning}
                    </text>
                  ) : null}
                </>
              ) : (
                <text fg={accountError ? colors.error : colors.muted} wrapMode="word">
                  {accountError ?? "Loading identity…"}
                </text>
              )}
            </Section>
          </box>

          <Section title="Quota usage">
            {usage.quota ? (
              <>
                <InfoRow
                  label="Sandboxes"
                  value={`${metricValue(usage.quota.sandboxes, String)} (${usage.running} running)`}
                  color={metricColor(usage.quota.sandboxes)}
                />
                <InfoRow
                  label="CPU"
                  value={metricValue(usage.quota.cpu, String)}
                  color={metricColor(usage.quota.cpu)}
                />
                <InfoRow
                  label="Memory"
                  value={`${metricValue(usage.quota.memoryMB, usageGigabytes)} GB`}
                  color={metricColor(usage.quota.memoryMB)}
                />
              </>
            ) : (
              <>
                <InfoRow
                  label="Sandboxes"
                  value={`${usage.sandboxes} (${usage.running} running)`}
                />
                <InfoRow label="CPU" value={String(usage.cpu)} />
                <InfoRow label="Memory" value={`${usageGigabytes(usage.memoryMB)} GB`} />
              </>
            )}
            <InfoRow label="Disk" value={`${usage.diskGB} GB`} />
            <InfoRow
              label="Snapshots"
              value={usage.snapshots === null ? "Not loaded" : String(usage.snapshots)}
            />
            {usage.team ? <InfoRow label="Team" value={usage.team} /> : null}
          </Section>

          <Section title="Profiles">
            <InfoRow label="Config source" value={sourceLabel(source)} />
            <InfoRow label="Active profile" value={activeProfile ?? "—"} />
            {configUrl ? <InfoRow label="API URL" value={configUrl} /> : null}
            {profileBlockedReason ? (
              <text fg={colors.warning} wrapMode="word">
                {profileBlockedReason}
              </text>
            ) : (
              <text fg={colors.muted} wrapMode="word">
                Enter switches to a profile. a adds a profile and d deletes the selected one.
              </text>
            )}
            {profiles.length === 0 ? (
              <text fg={colors.muted}>No profiles are saved.</text>
            ) : (
              <box flexDirection="column" flexShrink={0}>
                {profiles.map((profile, index) => (
                  <ProfileRow
                    key={profile.name}
                    profile={profile}
                    selected={index === selectedProfileIndex}
                  />
                ))}
              </box>
            )}
            {deleteProfileName ? (
              <box
                id="account-delete-profile"
                border
                borderStyle="rounded"
                borderColor={colors.error}
                backgroundColor={colors.panelAlt}
                flexDirection="column"
                flexShrink={0}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                gap={1}
              >
                <text fg={colors.error}>Delete profile {deleteProfileName}?</text>
                <text fg={colors.muted} wrapMode="word">
                  Direct-SSH entries for this profile's sandboxes stop working until you add it
                  again.
                </text>
                <text fg={colors.muted}>enter delete · esc cancel</text>
              </box>
            ) : null}
          </Section>

          <Section title="API tokens">
            {tokensNote ? (
              <text fg={colors.muted} wrapMode="word">
                {tokensNote}
              </text>
            ) : null}
            {tokensVisible ? (
              <>
                {tokensLoading ? <text fg={colors.accent}>Loading API tokens…</text> : null}
                {tokensError ? (
                  <text fg={colors.error} wrapMode="word">
                    {tokensError}
                  </text>
                ) : null}
                {!tokensLoading && !tokensError && tokens.length === 0 ? (
                  <text fg={colors.muted}>No API tokens.</text>
                ) : null}
                {tokens.length > 0 ? (
                  <box id="account-token-list" flexDirection="column" flexShrink={0}>
                    <box flexDirection="row" flexShrink={0} paddingLeft={1} paddingRight={1}>
                      <box width={2}>
                        <text> </text>
                      </box>
                      <box width={TOKEN_NAME_WIDTH}>
                        <text fg={colors.muted}>NAME</text>
                      </box>
                      <box width={TOKEN_ID_WIDTH}>
                        <text fg={colors.muted}>ID</text>
                      </box>
                      <box width={TOKEN_ROLE_WIDTH}>
                        <text fg={colors.muted}>ROLE</text>
                      </box>
                      <box width={TOKEN_TEAM_WIDTH}>
                        <text fg={colors.muted}>TEAM</text>
                      </box>
                      <box width={TOKEN_DATE_WIDTH}>
                        <text fg={colors.muted}>CREATED</text>
                      </box>
                      <box width={TOKEN_DATE_WIDTH}>
                        <text fg={colors.muted}>EXPIRES</text>
                      </box>
                    </box>
                    {tokens.map((token, index) => (
                      <TokenRow
                        key={token.id}
                        token={token}
                        index={index}
                        selected={index === selectedTokenIndex}
                      />
                    ))}
                  </box>
                ) : null}
                {revokeToken ? (
                  <box
                    id="account-revoke-token"
                    border
                    borderStyle="rounded"
                    borderColor={colors.error}
                    backgroundColor={colors.panelAlt}
                    flexDirection="column"
                    flexShrink={0}
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={1}
                    paddingBottom={1}
                    gap={1}
                  >
                    <text fg={colors.error} wrapMode="word">
                      Revoke token {revokeToken.name} ({revokeToken.id})?
                    </text>
                    {revokeToken.id === account?.principalId ? (
                      <text fg={colors.warning} wrapMode="word">
                        This is the token lewdev is using. You will be signed out.
                      </text>
                    ) : null}
                    {revokeError ? (
                      <text fg={colors.error} wrapMode="word">
                        {revokeError}
                      </text>
                    ) : null}
                    <text fg={colors.muted}>enter revoke · esc cancel</text>
                  </box>
                ) : null}
                {tokenForm ? (
                  <TokenForm
                    values={tokenForm}
                    focus={tokenFocus}
                    error={tokenFormError}
                    creating={tokenCreating}
                  />
                ) : null}
                {createdToken ? (
                  <SecretPanel
                    created={createdToken}
                    mode={secretMode}
                    profileName={secretProfileName}
                    error={secretError}
                    canSaveProfile={profileBlockedReason === null}
                  />
                ) : null}
                {!tokenForm && !createdToken && canManageTokens ? (
                  <text fg={colors.muted}>t creates a token. r revokes the selected token.</text>
                ) : null}
              </>
            ) : null}
          </Section>
        </box>
      </box>
    </scrollbox>
  );
}

export function ProfileSwitcherPanel({
  profiles,
  index,
  activeProfile,
  blockedReason,
}: {
  profiles: ProfileSummary[];
  index: number;
  activeProfile: string | null;
  blockedReason: string | null;
}) {
  return (
    <scrollbox flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Switch profile" width={72}>
        {blockedReason ? (
          <text fg={colors.warning} wrapMode="word">
            {blockedReason}
          </text>
        ) : profiles.length === 0 ? (
          <text fg={colors.muted}>No profiles are saved.</text>
        ) : (
          <box flexDirection="column" flexShrink={0}>
            {profiles.map((profile, row) => {
              const selected = row === index;
              return (
                <box
                  key={profile.name}
                  flexDirection="row"
                  flexShrink={0}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={selected ? colors.selection : undefined}
                >
                  <box width={2}>
                    <text fg={selected ? colors.accent : colors.muted}>{selected ? "›" : " "}</text>
                  </box>
                  <box width={20} flexShrink={0}>
                    <text fg={selected ? colors.accent : colors.text}>
                      {truncate(profile.name, 20)}
                    </text>
                  </box>
                  <box flexGrow={1}>
                    <text fg={colors.muted} wrapMode="none">
                      {profile.apiUrl}
                    </text>
                  </box>
                  {profile.name === activeProfile ? (
                    <box flexShrink={0} paddingLeft={1}>
                      <text fg={colors.success}>active</text>
                    </box>
                  ) : null}
                </box>
              );
            })}
          </box>
        )}
        <text fg={colors.muted}>↑/↓ move · enter switch · esc close</text>
      </Panel>
    </scrollbox>
  );
}
