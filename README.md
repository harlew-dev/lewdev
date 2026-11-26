<h1 align="center">Lewdev</h1>

<p align="center">Manage AerolVM sandboxes from your terminal.</p>

---

### Quick start

You'll need [Bun 1.4.5 or newer](https://bun.com/docs/installation), an [AerolVM](https://microvm.aerol.ai/) API URL and token, and OpenSSH for sandbox access. On Windows, use PowerShell in Windows Terminal with the [OpenSSH Client](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse) installed.

```sh
git clone https://github.com/harlew-dev/lewdev.git
cd lewdev
bun install --frozen-lockfile
bun run dev
```

Enter your API URL and token on the Connect screen. Switch between the **Sandboxes** and **Snapshots** tabs with `Tab`, `Shift+Tab`, `1`, or `2`. Use the arrow keys and Enter to select a sandbox and manage its lifecycle, ports, snapshots, or SSH session. Press `n` to create a sandbox and `Esc` to go back. On the Snapshots tab, `n` registers a snapshot from an image reference or a Dockerfile, and Enter opens a snapshot's details to boot a sandbox from it or delete it. The bottom of each home tab sums your usage and shows your team's quota and name when the server reports them.

### Install

Linux and macOS (x64 or arm64):

```sh
curl -fsSL https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.sh | bash
```

Windows x64 (PowerShell):

```powershell
irm https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.ps1 | iex
```

The scripts download the latest release from GitHub, verify its SHA-256, and install `lewdev` to `~/.local/bin` (or `$LEWDEV_INSTALL_DIR`) on Linux/macOS and `%LOCALAPPDATA%\Programs\lewdev` on Windows. Set `LEWDEV_VERSION=0.2.0` to install a specific release.

You can also download an asset from the [releases page](https://github.com/harlew-dev/lewdev/releases): `lewdev-linux-x64`, `lewdev-linux-arm64`, `lewdev-darwin-arm64`, `lewdev-darwin-x64`, or `lewdev-windows-x64.exe`. The macOS binaries are ad-hoc signed but not notarised; if you downloaded one with a browser, run `xattr -d com.apple.quarantine <file>` before launching it. Browser-downloaded Windows binaries may trigger SmartScreen; choose **More info** → **Run anyway** if you trust the release.

### Build

Run `bun run build`. Launch `./dist/lewdev` on Linux or macOS, or `.\dist\lewdev.exe` in PowerShell.

### Updates

Standalone Linux, macOS, and Windows x64 builds check for a newer release at most once a day on startup. When one is available, lewdev shows an info toast and an `↑` marker in the home usage bar. Run `lewdev update` to download, verify, and install it, or `lewdev update --check` to only check. Set `LEWDEV_NO_UPDATE_CHECK=1` to turn the startup check off.

### Releasing

One-time setup: run `scripts/release-keygen.sh`. It writes the public key into `packages/core/src/release-key.ts` and prints the `gh secret set` command that stores the private key as the `LEWDEV_RELEASE_SIGNING_KEY` secret of the `release` environment. Back that key up: installed copies only accept updates it signed.

For each release, bump the version in `package.json`, `apps/tui/package.json` and `packages/core/package.json`, run `bun run check`, commit, push `main` and wait for CI. Then push an annotated tag whose message is the release title:

```sh
git tag -a vX.Y.Z -m "vX.Y.Z: <what changed>"
git push origin vX.Y.Z
```

The release workflow checks that the tag matches the package version, builds and smoke-tests the Linux, macOS and Windows x64 binaries, signs `SHA256SUMS`, and uploads everything to a **draft** release. Check the assets, then publish it with the written notes: `gh release edit vX.Y.Z --title "vX.Y.Z: …" --notes-file notes.md --draft=false`.

### Configuration

Lewdev stores its config, sandbox SSH keys, and gateway host keys under `$XDG_CONFIG_HOME/lewdev` or `~/.config/lewdev`. On Windows the default is `%USERPROFILE%\.config\lewdev`. Set `SB_API_URL` and `SB_API_TOKEN` to override the saved values. SSH keys are saved when you create a sandbox through Lewdev.

### Contributing

Run `bun run check` for formatting, lint, types, and tests. See [AGENTS.md](AGENTS.md) for the workspace layout.
