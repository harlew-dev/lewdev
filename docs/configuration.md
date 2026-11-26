# Configuration

lewdev stores its config, sandbox SSH keys and gateway host keys under `$XDG_CONFIG_HOME/lewdev` or `~/.config/lewdev`. On Windows the default is `%USERPROFILE%\.config\lewdev`.

| Variable                   | Effect                                         |
| -------------------------- | ---------------------------------------------- |
| `SB_API_URL`               | AerolVM server URL; overrides the saved value  |
| `SB_API_TOKEN`             | AerolVM API token; overrides the saved value   |
| `LEWDEV_NO_UPDATE_CHECK=1` | turns off the daily [update check](updates.md) |

SSH keys are saved when you create a sandbox through lewdev. lewdev keeps gateway host keys in its own `known_hosts` and never edits `~/.ssh/known_hosts`.
