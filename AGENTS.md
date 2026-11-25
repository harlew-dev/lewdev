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
- `bun run build` — compile the standalone binary to `dist/lewdev`
- `bun run check` — Biome format check, Biome lint, TypeScript, and core tests
- `bun run format` — rewrite formatting with Biome
- `bun test packages/core` — core unit tests only

Bun may not be on `PATH` in non-login shells; use `~/.bun/bin/bun` when needed.

## Conventions

- Dependency versions are pinned exactly. Do not add `^` or `~` ranges.
- TypeScript is strict, with `noUncheckedIndexedAccess`; keep it clean.
- Config and key files are created with mode `0600` and directories with `0700`. Tests must use
  temporary `XDG_CONFIG_HOME` values and must never touch the real `~/.config/lewdev`.
- SDK calls go through `packages/core/src/client.ts`. The `AerolSdk` interface exists so tests can
  inject a fake instead of contacting a server.
- The TUI must not crash on SDK or filesystem errors: show an inline message or toast.
- SSH uses the system `ssh` binary with
  `-i <key> -p 2220 -o UserKnownHostsFile=<config-dir>/known_hosts <sandbox-id>@<host>`, run in a PTY
  inside the TUI. The host is derived from the configured API URL's hostname. lewdev keeps gateway
  host keys in its own `known_hosts` (mode 0600) and never edits `~/.ssh/known_hosts`; "Forget saved
  host key" clears an entry with `ssh-keygen -R` behind a confirmation. SSH goes only through the AerolVM gateway
  (https://microvm.aerol.ai/ssh-access/) for now: no sshd in sandboxes, no user-supplied keys.
- Keep destructive actions behind a confirmation and never log the API token or private keys.

## Reference

- AerolVM docs: https://microvm.aerol.ai/
- SDK source types: `node_modules/@aerol-ai/aerolvm-sdk/dist/*.d.ts`
