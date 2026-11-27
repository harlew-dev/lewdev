# Configuration

lewdev stores its config, sandbox SSH keys and gateway host keys under `$XDG_CONFIG_HOME/lewdev` or `~/.config/lewdev`. On Windows the default is `%USERPROFILE%\.config\lewdev`.

| Variable                   | Effect                                         |
| -------------------------- | ---------------------------------------------- |
| `SB_API_URL`               | AerolVM server URL; overrides the saved value  |
| `SB_API_TOKEN`             | AerolVM API token; overrides the saved value   |
| `LEWDEV_PROFILE`           | saved profile to use instead of the active one |
| `LEWDEV_NO_UPDATE_CHECK=1` | turns off the daily [update check](updates.md) |

## Profiles

`config.json` can hold several servers or accounts, each saved as a named profile. A config written by an older lewdev becomes the `default` profile the first time a profile is saved. Add, switch and delete profiles on the **Account** tab, or press `p` on the Sandboxes or Snapshots list. CLI commands take `--profile <name>`; naming a profile that does not exist is an error rather than a fallback.

Private direct-SSH entries record their profile in the ProxyCommand (`lewdev ssh-proxy --profile <name> <sandbox-id>`), so switching profiles never sends a sandbox's SSH to another server. Entries written before profiles existed have no `--profile` and keep using the `default` profile. While `SB_API_URL` or `SB_API_TOKEN` is set, the environment decides the server, so lewdev does not let you switch or edit profiles.

SSH keys are saved when you create a sandbox through lewdev. lewdev keeps its host keys in its own `known_hosts` and never edits `~/.ssh/known_hosts`. When the gateway resolves to several nodes with different host keys, choose **Trust gateway host keys** on the SSH settings page to scan and save every node's key.

## Direct SSH

The embedded terminal on the sandbox page goes through the AerolVM gateway. For VS Code Remote-SSH, Cursor, JetBrains or plain `ssh`, choose **Set up SSH** on the sandbox page, then pick a mode:

- **Set up private SSH** (recommended, default): no port is exposed. SSH reaches `sshd -i` inside the sandbox through `lewdev ssh-proxy`, which uses the AerolVM API stream. This is the most private option.
- **Set up public SSH**: exposes TCP port 22 through AerolVM so machines without lewdev can connect. Login stays key-only for root.

Both modes:

- install `sshd` inside the sandbox (Ubuntu/Debian, Alpine, Fedora or RHEL package managers);
- create a per-sandbox key at `<config-dir>/keys/<sandbox-id>.direct` and authorize its public key for root;
- write key-only sshd settings to `/etc/ssh/sshd_config.d/00-lewdev.conf`;
- save the sandbox host key in lewdev's `known_hosts`;
- write a `Host lewdev-<sandbox-id>` block to `<config-dir>/ssh_config`.

Private blocks use `ProxyCommand "<lewdev>" ssh-proxy <sandbox-id>` and `HostKeyAlias`; public blocks use `HostName` and `Port`. Setup works for any sandbox, including ones lewdev did not create.

After setup, the sandbox page hides **Set up SSH**. Use **Repair SSH** in SSH Settings to re-run setup in the current mode, or **Reset SSH** after the sandbox was wiped or reinstalled. Reset removes lewdev's old key and local state, then sets up again with a fresh key; other authorized keys are kept.

lewdev uses the alias `lewdev-<sandbox-id>` for `ssh` and VS Code. The first time it needs the alias, lewdev asks before adding one `Include` line to `~/.ssh/config`. If you decline, **Copy SSH command** uses the explicit command instead; **Open in VS Code** asks again when it needs the alias. lewdev never edits `~/.ssh/known_hosts`.

The SSH settings page shows the connection mode and details, root's authorized keys and the gateway terminal settings. From there you can add or remove public keys, switch between private and public mode, disable direct SSH, repair or reset it, and manage the gateway host keys. **Open in VS Code** opens a directory picker for the sandbox, starting at the last folder you opened or `/root`.

Deleting a sandbox removes its SSH config block, host key entry and direct key.
