#!/usr/bin/env bun
import {
  checkForUpdate,
  cleanupPreviousBinary,
  DEFAULT_PROFILE,
  describeError,
  downloadVerifiedUpdate,
  extractProfileFlag,
  installUpdate,
  isSandboxCommand,
  isStandaloneBuild,
  LewdevApi,
  listProfiles,
  loadConfig,
  runSandboxCli,
  runSshProxy,
  UpdateError,
  writeUpdateState,
} from "@lewdev/core";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { App } from "./app";
import { colors } from "./theme";
import { VERSION } from "./version";

const HELP = `lewdev ${VERSION} — a terminal client for AerolVM sandboxes

Usage: lewdev [--help] [--version]
       lewdev update [--check]
       lewdev ssh-proxy [--profile <name>] <sandbox-id>
       lewdev ls [--json]
       lewdev start <sandbox>
       lewdev stop <sandbox>
       lewdev delete <sandbox> [--yes]
       lewdev ssh <sandbox>
       lewdev code <sandbox> [remote-path]
       lewdev exec <sandbox> -- <command...>

Configuration:
  $XDG_CONFIG_HOME/lewdev/config.json (or ~/.config/lewdev/config.json)
  On Windows, the default is %USERPROFILE%\\.config\\lewdev\\config.json.

Environment overrides:
  SB_API_URL             AerolVM server URL
  SB_API_TOKEN           AerolVM API token
  LEWDEV_NO_UPDATE_CHECK=1 disables the startup update check

Sandbox commands:
  <sandbox> is an exact sandbox ID, then an exact name. Ambiguous names fail.
  --profile <name>       Use a saved profile instead of the active one (or LEWDEV_PROFILE)
  ls                     List sandboxes; --json prints lewdev's SandboxInfo array
  start / stop           Start or stop a sandbox
  delete                 Delete a sandbox and its local keys; asks unless --yes
  ssh                    Open a direct SSH session, or the gateway when not set up
  code                   Open VS Code Remote-SSH (direct SSH must be set up)
  exec                   Run a command and stream its output and exit code

Direct SSH:
  lewdev ssh-proxy <id>  Internal ProxyCommand endpoint (stdout is the SSH stream)

Updates:
  lewdev update          Replace this binary with the latest release
  lewdev update --check  Check without installing
  Linux, macOS and Windows x64 standalone builds only.

Keys:
  ↑/↓ or j/k move · enter select/open · esc back · ctrl+c quit
  Tabs: 1 sandboxes · 2 snapshots · 3 account · tab cycles all three
  Sandbox list: n new · c connect · p switch profile · q quit
  Sandbox page: enter runs the selected action
  Ports page: o open port · x close port
  Sessions page: enter attach · v output · k kill · n new shell
  Account: enter switch profile · a add profile · d delete profile
           t new token · r revoke token · c copy secret · s save as profile
  Terminal: ctrl+] detaches; the session keeps running

Private sandbox keys are stored in the same config directory under keys/.
`;

function printHelp(): void {
  console.log(HELP);
}

async function runUpdate(args: string[]): Promise<number> {
  if (args.some((arg) => arg !== "--check")) {
    const unknown = args.find((arg) => arg !== "--check") ?? args[0];
    console.error(`Unknown option: ${unknown}`);
    console.error("Run `lewdev --help` for usage.");
    return 1;
  }
  if (!isStandaloneBuild()) {
    console.error(
      "lewdev update only works for standalone builds. This copy is running from source.",
    );
    return 1;
  }

  const checkOnly = args.includes("--check");
  try {
    const check = await checkForUpdate(VERSION);
    if (!check.available) {
      console.log(`lewdev ${VERSION} is up to date.`);
      return 0;
    }
    if (!check.assetName) {
      console.error(
        `lewdev ${check.latest.version} is available, but this platform has no release asset.`,
      );
      return 1;
    }
    if (checkOnly) {
      console.log(
        `lewdev ${check.latest.version} is available. Run \`lewdev update\` to install it.`,
      );
      return 0;
    }

    console.log(`Updating lewdev ${VERSION} → ${check.latest.version}…`);
    const binary = await downloadVerifiedUpdate(check.latest, check.assetName);
    await installUpdate(binary);
    await writeUpdateState({
      checkedAt: new Date().toISOString(),
      latestVersion: check.latest.version,
    });
    console.log(`Updated to ${check.latest.version}. Restart lewdev to use it.`);
    return 0;
  } catch (error) {
    if (error instanceof UpdateError) {
      console.error(error.message);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    return 1;
  }
}

async function main(): Promise<void> {
  if (isStandaloneBuild()) {
    void cleanupPreviousBinary();
  }
  const args = process.argv.slice(2);
  const helpRequested =
    args[0] === "--help" || args[0] === "-h" || (args[0] !== "exec" && args.includes("--help"));
  if (helpRequested) {
    printHelp();
    return;
  }
  if (
    args[0] === "--version" ||
    args[0] === "-v" ||
    (args[0] !== "exec" && args.includes("--version"))
  ) {
    console.log(`lewdev ${VERSION}`);
    return;
  }
  if (args[0] === "update") {
    process.exitCode = await runUpdate(args.slice(1));
    return;
  }
  if (args[0] === "ssh-proxy") {
    let parsed: ReturnType<typeof extractProfileFlag>;
    try {
      parsed = extractProfileFlag(args.slice(1));
    } catch (error) {
      console.error(describeError(error));
      process.exitCode = 1;
      return;
    }
    const sandboxId = parsed.args[0];
    if (parsed.args.length !== 1 || !sandboxId) {
      console.error("Usage: lewdev ssh-proxy [--profile <name>] <sandbox-id>");
      process.exitCode = 1;
      return;
    }
    try {
      // Blocks written before profiles carry no --profile; they were set up
      // against the server that became the default profile, so keep using it
      // even after the user switches the active profile.
      const profile =
        parsed.profile ??
        ((await listProfiles()).some((entry) => entry.name === DEFAULT_PROFILE)
          ? DEFAULT_PROFILE
          : undefined);
      const loaded = await loadConfig(process.env, profile === undefined ? {} : { profile });
      if (!loaded.config) {
        console.error("lewdev is not configured. Run lewdev and connect to a server first.");
        process.exitCode = 1;
        return;
      }
      const code = await runSshProxy(LewdevApi.fromConfig(loaded.config), sandboxId, {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      });
      process.exitCode = code;
      process.stdin.pause();
      process.stdin.destroy();
    } catch (error) {
      console.error(describeError(error));
      process.exitCode = 1;
    }
    return;
  }
  if (isSandboxCommand(args[0])) {
    process.exitCode = await runSandboxCli(args);
    return;
  }
  if (args.length > 0) {
    console.error(`Unknown option: ${args[0]}`);
    console.error("Run `lewdev --help` for usage.");
    process.exitCode = 1;
    return;
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    backgroundColor: colors.background,
  });
  renderer.setTerminalTitle("lewdev");
  createRoot(renderer).render(<App />);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
