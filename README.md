# lewdev

A terminal client for [AerolVM](https://microvm.aerol.ai/) sandboxes. lewdev connects to an
AerolVM server, creates sandboxes from an image, starts and stops them, exposes ports, and opens
an SSH session with the system `ssh` client.

The repository is a Bun workspace. The reusable logic lives in a UI-free core package; the TUI is
the first app, and web/desktop apps can reuse the same core later.

## Requirements

- Bun 1.4.5 or newer (`~/.bun/bin/bun` if Bun is not on your `PATH`)
- A running AerolVM server
- The system `ssh` client for the `S` shortcut

## Install and run

```sh
bun install
bun run dev
```

`bun run build` compiles a standalone binary to `dist/lewdev`:

```sh
bun run build
./dist/lewdev
```

Run `lewdev --help` for the non-interactive usage summary.

## Configuration

On first run, lewdev opens a Connect screen. Enter the AerolVM API URL and token; lewdev verifies
the server with its health check before saving. The config is written to:

```
$XDG_CONFIG_HOME/lewdev/config.json   # or ~/.config/lewdev/config.json
```

The directory is created with mode `0700` and the file with mode `0600`.

`SB_API_URL` and `SB_API_TOKEN` override the file field by field. A config is usable only when both
the URL and token are present. Press `c` in the TUI to reopen the Connect screen.

Sandbox private keys are returned by AerolVM only at create time. lewdev saves them to
`$XDG_CONFIG_HOME/lewdev/keys/<sandbox-id>` with mode `0600` and deletes a key when the sandbox is
deleted through lewdev. For sandboxes created elsewhere, the TUI reports that no key is stored.

## Keyboard

| Key       | Action                     |
| --------- | -------------------------- |
| `n`       | New sandbox                |
| `s` / `x` | Start / stop               |
| `R`       | Restart (stop, then start) |
| `d`       | Delete, with confirmation  |
| `enter`   | Details                    |
| `S`       | SSH (suspends the TUI)     |
| `p`       | Ports                      |
| `c`       | Connect screen             |
| `q`       | Quit                       |

The sandbox list refreshes every three seconds. Errors appear inline or as a toast and do not exit
the TUI.

## Workspace

```
packages/core   SDK wrapper, config, key storage, SSH helpers (no UI imports)
apps/tui        OpenTUI React app and the `lewdev` binary
```

## Checks

```sh
bun run format       # rewrite formatting
bun run check        # format check, lint, typecheck, tests
bun run build        # standalone binary
```

Core tests use temporary config directories and a fake SDK; they never read or write the real
`~/.config/lewdev` and do not contact an AerolVM server.
