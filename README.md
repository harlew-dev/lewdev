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

- **Sandboxes** - create, start, stop and delete sandboxes, open ports, and SSH in
- **Snapshots** - save a sandbox, register one from an image or Dockerfile, and boot new sandboxes from it

Switch tabs with `Tab` or `1`/`2`, move with the arrow keys, select with `Enter` and go back with `Esc`.

### Documentation

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
