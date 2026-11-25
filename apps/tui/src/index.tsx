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
  On Windows, the default is %USERPROFILE%\\.config\\lewdev\\config.json.

Environment overrides:
  SB_API_URL    AerolVM server URL
  SB_API_TOKEN  AerolVM API token

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
