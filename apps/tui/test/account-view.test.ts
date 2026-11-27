import { describe, expect, test } from "bun:test";

import {
  accountRowSelection,
  canListApiTokens,
  canManageApiTokens,
  defaultTokenForm,
  defaultTokenTeam,
  nextTokenFormField,
  profileBlockReason,
  profileNameFromUrl,
  tokenAccessNote,
  tokenExpiryWarning,
  tokenFormFields,
  tokenFormInput,
} from "../src/account-view";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

describe("token form", () => {
  test("defaults the team for the role and the caller", () => {
    expect(defaultTokenTeam("viewer", "platform")).toBe("platform");
    expect(defaultTokenTeam("runner", undefined)).toBe("");
    expect(defaultTokenTeam("auditor", "platform")).toBe("*");
    expect(defaultTokenTeam("admin", undefined)).toBe("*");
  });

  test("builds the input, including a custom expiry", () => {
    const values = {
      name: "laptop",
      role: "viewer" as const,
      team: "platform",
      expiry: "custom" as const,
      customExpiry: "45d",
    };
    expect(tokenFormInput(values)).toEqual({
      name: "laptop",
      role: "viewer",
      team: "platform",
      expiresIn: "45d",
    });
    expect(tokenFormInput({ ...values, expiry: "90d" })).toEqual({
      name: "laptop",
      role: "viewer",
      team: "platform",
      expiresIn: "90d",
    });
  });

  test("shows the custom expiry field only for a custom duration", () => {
    const values = defaultTokenForm({ role: "viewer", team: "platform" });
    expect(tokenFormFields(values)).toEqual(["name", "role", "team", "expiry", "submit"]);
    expect(tokenFormFields({ ...values, expiry: "custom" })).toEqual([
      "name",
      "role",
      "team",
      "expiry",
      "custom-expiry",
      "submit",
    ]);
    expect(nextTokenFormField(values, "expiry", 1)).toBe("submit");
    expect(nextTokenFormField({ ...values, expiry: "custom" }, "expiry", 1)).toBe("custom-expiry");
  });
});

describe("API token access", () => {
  test("only auditors and admins list tokens, and only admins manage them", () => {
    expect(canListApiTokens("auditor")).toBe(true);
    expect(canManageApiTokens("auditor")).toBe(false);
    expect(canListApiTokens("admin")).toBe(true);
    expect(canManageApiTokens("admin")).toBe(true);
    expect(canListApiTokens("viewer")).toBe(false);
    expect(tokenAccessNote("viewer")).toBe("The API token list needs the auditor or admin role.");
    expect(tokenAccessNote("auditor")).toBe("Creating and revoking tokens needs the admin role.");
    expect(tokenAccessNote("admin")).toBeNull();
  });
});

describe("token expiry", () => {
  test("warns only inside the last week, and after expiry", () => {
    expect(tokenExpiryWarning(undefined, NOW)).toBeNull();
    expect(tokenExpiryWarning("2026-01-20T00:00:00.000Z", NOW)).toBeNull();
    expect(tokenExpiryWarning("2026-01-08T00:00:00.000Z", NOW)).toBe(
      "This token expires in 7 days.",
    );
    expect(tokenExpiryWarning("2026-01-02T00:00:00.000Z", NOW)).toBe(
      "This token expires in 1 day.",
    );
    expect(tokenExpiryWarning("2025-12-31T00:00:00.000Z", NOW)).toBe("This token has expired.");
  });
});

describe("profile names and environment overrides", () => {
  test("suggests the first hostname label", () => {
    expect(profileNameFromUrl("https://eu-west.example.com")).toBe("eu-west");
    expect(profileNameFromUrl("127.0.0.1:8080")).toBe("127");
    expect(profileNameFromUrl("not a url")).toBe("");
  });

  test("names the environment variables that block profile changes", () => {
    expect(profileBlockReason("env", { SB_API_URL: "http://a", SB_API_TOKEN: "t" })).toBe(
      "The server is set by SB_API_URL and SB_API_TOKEN. Unset them to change profiles.",
    );
    expect(profileBlockReason("mixed", { SB_API_TOKEN: "t" })).toBe(
      "The server is set by SB_API_TOKEN. Unset it to change profiles.",
    );
    expect(profileBlockReason("file", { SB_API_URL: "http://a" })).toBeNull();
  });
});

describe("account cursor", () => {
  test("walks the profiles and then the tokens", () => {
    const profiles = [{ name: "eu", apiUrl: "http://eu", active: true }];
    const tokens = [
      {
        id: "tok_1",
        name: "laptop",
        role: "viewer",
        team: "platform",
        createdBy: "me",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
        expired: false,
      },
    ];
    expect(accountRowSelection(profiles, tokens, 0).profile?.name).toBe("eu");
    expect(accountRowSelection(profiles, tokens, 1).token?.id).toBe("tok_1");
    expect(accountRowSelection(profiles, tokens, 99).token?.id).toBe("tok_1");
    expect(accountRowSelection([], [], 5)).toEqual({ profile: null, token: null, index: 0 });
  });
});
