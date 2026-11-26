# Scriptable CLI

`lewdev` opens the TUI when run without arguments. It also has subcommands for scripts and for
power users who work from a shell.

Every command uses the same configuration as the TUI: `SB_API_URL` and `SB_API_TOKEN` override
fields from `$XDG_CONFIG_HOME/lewdev/config.json` (or `~/.config/lewdev/config.json`). If lewdev is
not configured, commands print the same message as the TUI's `ssh-proxy` endpoint.

## Choosing a sandbox

`<sandbox>` is matched by exact ID first, then by exact name. Names are not required to be unique,
so a name shared by several sandboxes is an error that lists their IDs. Use the ID in that case.

```sh
lewdev ls                 # aligned table: name, ID, status, image, created
lewdev ls --json          # JSON array of lewdev's SandboxInfo objects
lewdev start web
lewdev stop sb-0123456789abcdef
```

`ls --json` prints only lewdev's own sandbox fields; it never includes the API token or private
keys.

## Deleting a sandbox

`lewdev delete` destroys the sandbox and performs the same local cleanup as the TUI: it removes the
sandbox's block from lewdev's `ssh_config`, its direct SSH key and its `known_hosts` entry, plus its
saved gateway key.

```sh
lewdev delete web           # asks "Delete web (sb-...)? [y/N]" on a terminal
lewdev delete web --yes     # no prompt, for scripts
```

Without `--yes`, a non-interactive shell refuses to delete anything.

## SSH

```sh
lewdev ssh web
```

If direct SSH is configured for the sandbox, this runs the system `ssh` with lewdev's
`Host lewdev-<id>` alias. If `~/.ssh/config` does not include lewdev's config yet, it passes
lewdev's `ssh_config` with `-F` instead. When direct SSH is not configured, it falls back to the
gateway's session-only SSH on port 2220 using the saved gateway key and lewdev's private
`known_hosts`.

If neither is available, the command asks you to choose "Set up SSH" in the TUI.

`lewdev ssh` inherits the terminal and exits with ssh's exit code.

## VS Code

```sh
lewdev code web
lewdev code web /root/app
```

`code` requires direct SSH to be set up and lewdev's config included from `~/.ssh/config`. It opens
the same `vscode://vscode-remote/ssh-remote+lewdev-<id>/<path>` URL as the TUI's "Open in VS Code",
using the `code` command when it is on `PATH`, and defaults to `/root`. Relative paths resolve
inside `/root`.

## Running commands

```sh
lewdev exec web -- uname -a
lewdev exec web -- ls -la /root
lewdev exec web -- sh -c 'apt-get update && apt-get install -y curl'
```

`exec` streams stdout and stderr live through the AerolVM exec stream and exits with the remote
exit code. Each argument after `--` is quoted for the sandbox's shell, so arguments with spaces
survive; use `sh -c '…'` when you need shell syntax such as pipes or `&&`.

## Exit codes

Commands exit with `0` on success and non-zero on failure. `ssh` and `exec` pass through the remote
exit code. Errors go to stderr, so stdout can be piped when using `ls --json` or `exec`.
