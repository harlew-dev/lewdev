# Updates

Installed copies of lewdev (Linux, macOS and Windows x64) check for a newer release at most once a day on startup. When one is available, lewdev shows a toast and an `↑ <version>` marker in the home usage bar.

```sh
lewdev update          # download, verify and install the latest release
lewdev update --check  # only check
```

`lewdev update` installs a release only after the Ed25519 signature over its `SHA256SUMS` and the binary's SHA-256 both match. The signature covers the version number, so an older release can't be passed off as a newer one.

- If lewdev is installed somewhere you can't write to, it says so: run `sudo lewdev update` on Linux or macOS, or use an elevated terminal on Windows.
- On Windows the running `lewdev.exe` is renamed to `lewdev.exe.old` and removed the next time lewdev starts.
- Set `LEWDEV_NO_UPDATE_CHECK=1` to turn the startup check off.
- A copy run from source (`bun run dev`) never updates itself; use `git pull`.
