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

Enter your API URL and token on the Connect screen. Use the arrow keys and Enter to select a sandbox and manage its lifecycle, ports, or SSH session. Press `n` to create a sandbox and `Esc` to go back.

### Build

Run `bun run build`. Launch `./dist/lewdev` on Linux or macOS, or `.\dist\lewdev.exe` in PowerShell.

### Configuration

Lewdev stores its config, sandbox SSH keys, and gateway host keys under `$XDG_CONFIG_HOME/lewdev` or `~/.config/lewdev`. On Windows the default is `%USERPROFILE%\.config\lewdev`. Set `SB_API_URL` and `SB_API_TOKEN` to override the saved values. SSH keys are saved when you create a sandbox through Lewdev.

### Contributing

Run `bun run check` for formatting, lint, types, and tests. See [AGENTS.md](AGENTS.md) for the workspace layout.
