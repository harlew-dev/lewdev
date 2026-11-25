#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { App } from "./app";
import { colors } from "./theme";

const VERSION = "0.1.0";

const HELP = `lewdev ${VERSION} — a terminal client for AerolVM sandboxes

Usage: lewdev [--help] [--version]

Configuration:
  $XDG_CONFIG_HOME/lewdev/config.json (or ~/.config/lewdev/config.json)
  The file and its directory are chmod 0600 / 0700.

Environment overrides:
  SB_API_URL    AerolVM server URL
  SB_API_TOKEN  AerolVM API token

Keys:
  n new · s start · x stop · R restart · d delete · enter details
  S ssh · p ports · c connect · q quit

Private sandbox keys are stored in the same config directory under keys/.
`;

function printHelp(): void {
  console.log(HELP);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`lewdev ${VERSION}`);
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
