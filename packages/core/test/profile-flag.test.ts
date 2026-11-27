import { describe, expect, test } from "bun:test";

import { extractProfileFlag, getSshProxyCommand } from "../src/index.js";

describe("extractProfileFlag", () => {
  test("takes --profile from anywhere before --", () => {
    expect(extractProfileFlag(["ls", "--profile", "work", "--json"])).toEqual({
      args: ["ls", "--json"],
      profile: "work",
    });
    expect(extractProfileFlag(["--profile=work", "stop", "box"])).toEqual({
      args: ["stop", "box"],
      profile: "work",
    });
  });

  test("leaves the remote command after -- alone", () => {
    expect(extractProfileFlag(["exec", "box", "--", "tool", "--profile", "x"])).toEqual({
      args: ["exec", "box", "--", "tool", "--profile", "x"],
    });
  });

  test("rejects a missing name", () => {
    expect(() => extractProfileFlag(["ls", "--profile"])).toThrow();
    expect(() => extractProfileFlag(["ls", "--profile", "--json"])).toThrow();
    expect(() => extractProfileFlag(["ls", "--profile="])).toThrow();
  });
});

describe("getSshProxyCommand", () => {
  const command = { execPath: "/usr/local/bin/lewdev", main: "", standalone: true };

  test("records the profile so switching profiles keeps the right server", () => {
    expect(getSshProxyCommand("sb-1", { ...command, profile: "Work" })).toBe(
      "/usr/local/bin/lewdev ssh-proxy --profile work sb-1",
    );
  });

  test("omits the flag when no profile is given", () => {
    expect(getSshProxyCommand("sb-1", command)).toBe("/usr/local/bin/lewdev ssh-proxy sb-1");
  });

  test("refuses a profile name that is unsafe in a command line", () => {
    expect(() => getSshProxyCommand("sb-1", { ...command, profile: "a; rm -rf ~" })).toThrow();
  });
});
