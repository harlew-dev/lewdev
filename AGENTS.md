# AGENTS.md

## Layout

- `packages/core` — UI-free logic: AerolVM SDK wrapper, config loading/writing, private-key
  storage, SSH command helpers, error formatting.
- `apps/tui` — the OpenTUI React terminal app and the `lewdev` binary.

**Core must never import React, OpenTUI, or anything from `apps/`.** Keep it usable by the future
web and desktop apps.

## Commands

Run from the repository root:

- `bun install` — install workspace dependencies
- `bun run dev` — run the TUI with watch
- `bun run build` — compile the standalone binary to `dist/lewdev` (Windows: `dist/lewdev.exe`)
- `bun run check` — Biome format check, Biome lint, TypeScript, and tests
- `bun run format` — rewrite formatting with Biome
- `bun test packages/core` — core unit tests only

Bun may not be on `PATH` in non-login shells; use `~/.bun/bin/bun` when needed.

## Conventions

- Dependency versions are pinned exactly. Do not add `^` or `~` ranges.
- TypeScript is strict, with `noUncheckedIndexedAccess`; keep it clean.
- On Unix, config and key files use mode `0600` and directories use `0700`. On Windows,
  the config directory and its files use ACLs scoped to the current user. Tests must use
  temporary `XDG_CONFIG_HOME` values and must never touch the real `~/.config/lewdev`.
- SDK calls go through `packages/core/src/client.ts`. The `AerolSdk` interface exists so tests can
  inject a fake instead of contacting a server.
- The TUI must not crash on SDK or filesystem errors: show an inline message or toast.
- The embedded terminal uses the AerolVM gateway's session-only SSH on port 2220 with the system
  `ssh` binary:
  `-i <gateway-key> -p 2220 -o IdentitiesOnly=yes -o UserKnownHostsFile=<config-dir>/known_hosts <sandbox-id>@<host>`,
  run in a PTY inside the TUI. The host comes from the configured API URL's hostname. lewdev keeps
  gateway host keys in its own private `known_hosts` and never edits `~/.ssh/known_hosts`; "Trust
  gateway host keys" scans every gateway node with `ssh-keyscan` and saves each key, and "Forget
  saved host key" clears them with `ssh-keygen -R`, both behind a confirmation.
- Direct SSH (VS Code Remote-SSH, plain `ssh`, Cursor, JetBrains) defaults to a private connection:
  no exposed port. The `Host lewdev-<id>` block uses `ProxyCommand` to run
  `lewdev ssh-proxy <id>`, which bridges SSH's stdin/stdout to `exec /usr/sbin/sshd -i` in the
  sandbox through `MicroVM.execStream`. The proxy buffers client input until sshd's first output
  because the SDK drops writes before the stream is open. `HostKeyAlias lewdev-<id>` names the
  `known_hosts` entry. The CLI subcommand writes only the stream to stdout, errors to stderr, and
  exits with the remote code.
- "Set up SSH" offers private (default) or public mode. Both install `openssh-server`, create a
  per-sandbox lewdev key, add its public key to `/root/.ssh/authorized_keys`, write key-only sshd
  settings and record the sandbox host key through `exec`. Private mode stops there: no daemon and
  no exposed port. Public mode starts sshd, exposes TCP port 22 through AerolVM, and writes a
  `HostName`/`Port` block instead. Existing public-mode blocks keep working. User-supplied public
  keys may be added to `authorized_keys`; private keys are never accepted.
- lewdev owns `<config-dir>/ssh_config` with one `Host lewdev-<id>` block per sandbox. It adds one
  `Include` line (with a `# Added by lewdev` comment) at the top of `~/.ssh/config` only after the
  user confirms, and never changes anything else there. It never edits `~/.ssh/known_hosts`.
  Deleting a sandbox removes its block, its direct key and its `known_hosts` entry. SSH Settings
  switches between private and public mode, and offers Repair and Reset.
- Keep destructive actions behind a confirmation and never log the API token or private keys.

## Reference

- AerolVM docs: https://microvm.aerol.ai/
- SDK source types: `node_modules/@aerol-ai/aerolvm-sdk/dist/*.d.ts`
