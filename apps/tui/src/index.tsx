#!/usr/bin/env bun
import {
  checkForUpdate,
  cleanupPreviousBinary,
  downloadVerifiedUpdate,
  installUpdate,
  isStandaloneBuild,
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

Configuration:
  $XDG_CONFIG_HOME/lewdev/config.json (or ~/.config/lewdev/config.json)
  On Windows, the default is %USERPROFILE%\\.config\\lewdev\\config.json.

Environment overrides:
  SB_API_URL             AerolVM server URL
  SB_API_TOKEN           AerolVM API token
  LEWDEV_NO_UPDATE_CHECK=1 disables the startup update check

Updates:
  lewdev update          Replace this binary with the latest release
  lewdev update --check  Check without installing
  Linux, macOS and Windows x64 standalone builds only.

Keys:
  ↑/↓ or j/k move · enter select/open · esc back · ctrl+c quit
  Sandbox list: n new · c connect · q quit
  Sandbox page: enter runs the selected action
  Ports page: o open port · x close port
  SSH session: ctrl+] closes the session

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
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`lewdev ${VERSION}`);
    return;
  }
  if (args[0] === "update") {
    process.exitCode = await runUpdate(args.slice(1));
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
