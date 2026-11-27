<h1 align="center">Lewdev</h1>

<p align="center">Manage AerolVM sandboxes from your terminal.</p>

---

### Installation

```bash
# Linux and macOS
curl -fsSL https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.ps1 | iex
```

Binaries for Linux (x64, arm64), macOS (Apple Silicon, Intel) and Windows x64 are on the [releases page](https://github.com/harlew-dev/lewdev/releases). Run `lewdev update` to update.

#### Installation Directory

The install script installs lewdev to `~/.local/bin` on Linux and macOS, and `%LOCALAPPDATA%\Programs\lewdev` on Windows.

### Usage

Run `lewdev` and enter your [AerolVM](https://microvm.aerol.ai/) API URL and token.

- **Sandboxes** - create, start, stop, resize and delete sandboxes; stop or delete them automatically when idle; open terminals that keep running after you detach; browse, upload and download files; manage ports, custom domains and network limits; read the audit log; and set up direct SSH for VS Code or plain `ssh`
- **Snapshots** - save a sandbox, register one from an image or Dockerfile, and boot new sandboxes from it
- **Account** - see your role, token expiry and quota, switch between saved servers (profiles), and manage API tokens as an admin

Switch tabs with `Tab` or `1`/`2`/`3`, move with the arrow keys, select with `Enter` and go back with `Esc`. Press `/` to filter a list, `s` to sort it, `p` to switch profiles and `?` for every key on the current page.

#### Scriptable CLI

Run sandboxes without opening the TUI:

```sh
lewdev ls --json
lewdev start web
lewdev ssh web
lewdev exec web -- uname -a
```

See [CLI](docs/cli.md) for every subcommand, sandbox name resolution and exit codes.

### Documentation

- [CLI](docs/cli.md)
- [Install](docs/install.md)
- [Updates](docs/updates.md)
- [Configuration](docs/configuration.md)
- [Build](docs/build.md)
- [Releasing](docs/releasing.md)

### Testing

You'll need [Bun 1.4.5 or newer](https://bun.com/docs/installation).

```sh
git clone https://github.com/harlew-dev/lewdev.git
cd lewdev
bun install --frozen-lockfile
bun run dev      # run the TUI from source
bun run check    # format, lint, types and tests
```

### Contributing

Run `bun run check` for formatting, lint, types, and tests. See [AGENTS.md](AGENTS.md) for the workspace layout.
