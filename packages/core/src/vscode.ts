import { spawn } from "node:child_process";

import { getDirectSshAlias } from "./direct-ssh.js";
import { describeError } from "./errors.js";
import { remotePathForUrl } from "./remote-path.js";

export interface VscodeLaunch {
  command: string;
  args: string[];
}

/**
 * Builds the command that opens VS Code Remote-SSH on a sandbox's direct-SSH
 * alias. `codeBinary` is the resolved `code` CLI, or null to use the
 * `vscode://` URL handler instead.
 */
export function vscodeLaunchCommand(
  sandboxId: string,
  directory: string,
  platform: NodeJS.Platform,
  codeBinary: string | null,
): VscodeLaunch {
  const alias = getDirectSshAlias(sandboxId);
  const url = `vscode://vscode-remote/ssh-remote+${alias}${remotePathForUrl(directory)}`;
  const win = platform === "win32";
  // On Windows `code` is a .cmd shim that needs a shell and breaks on paths with
  // spaces, so the vscode:// URL (no cmd metacharacters) goes through `start`.
  const code = win ? null : codeBinary;
  if (code) {
    return { command: code, args: ["--remote", `ssh-remote+${alias}`, directory] };
  }
  if (win) {
    return { command: "cmd", args: ["/d", "/c", "start", "", url] };
  }
  return { command: platform === "darwin" ? "open" : "xdg-open", args: [url] };
}

/** Opens VS Code Remote-SSH on the sandbox. Resolves once the launcher has spawned. */
export function openInVscode(sandboxId: string, directory: string): Promise<void> {
  const codeBinary =
    process.platform === "win32" || typeof Bun === "undefined" ? null : Bun.which("code");
  const launch = vscodeLaunchCommand(sandboxId, directory, process.platform, codeBinary);
  return new Promise<void>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", (error) => {
      reject(new Error(`Could not open VS Code: ${describeError(error)}`));
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
