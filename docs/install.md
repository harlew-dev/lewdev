# Install

## One-line install

Linux and macOS (x64 or arm64):

```sh
curl -fsSL https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.sh | bash
```

Windows x64 (PowerShell):

```powershell
irm https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.ps1 | iex
```

The scripts download the latest release from GitHub and check it against the release's `SHA256SUMS` before installing.

| Setting            | Linux and macOS            | Windows                               |
| ------------------ | -------------------------- | ------------------------------------- |
| Install folder     | `~/.local/bin`             | `%LOCALAPPDATA%\Programs\lewdev`      |
| Change the folder  | `LEWDEV_INSTALL_DIR=/path` | `$env:LEWDEV_INSTALL_DIR = 'C:\path'` |
| A specific release | `LEWDEV_VERSION=0.0.1`     | `$env:LEWDEV_VERSION = '0.0.1'`       |

On Linux and macOS the script warns if the install folder isn't on your `PATH`. On Windows it adds the folder to your user `PATH`; open a new terminal afterwards.

## Manual download

Download the file for your system from the [releases page](https://github.com/harlew-dev/lewdev/releases):

| Platform              | File                     |
| --------------------- | ------------------------ |
| Linux x64             | `lewdev-linux-x64`       |
| Linux arm64           | `lewdev-linux-arm64`     |
| macOS (Apple Silicon) | `lewdev-darwin-arm64`    |
| macOS (Intel)         | `lewdev-darwin-x64`      |
| Windows x64           | `lewdev-windows-x64.exe` |

- **macOS:** the binaries are ad-hoc signed but not notarised. If you downloaded one with a browser, run `xattr -d com.apple.quarantine <file>` before launching it.
- **Windows:** a browser-downloaded binary may trigger SmartScreen; choose **More info** → **Run anyway** if you trust the release.

## Requirements

You need an [AerolVM](https://microvm.aerol.ai/) API URL and token, and OpenSSH for sandbox access. On Windows, use PowerShell in Windows Terminal with the [OpenSSH Client](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse) installed.
