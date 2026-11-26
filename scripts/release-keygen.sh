#!/usr/bin/env bash
# Generates the Ed25519 key pair that signs lewdev releases.
#
#   scripts/release-keygen.sh [private-key-path]
#
# Writes the private key (mode 0600) outside the repository, embeds the public
# key in packages/core/src/release-key.ts, and prints the command that stores
# the private key as the LEWDEV_RELEASE_SIGNING_KEY GitHub secret.
#
# Back the private key up (e.g. in a password manager). Installed copies of
# lewdev only accept updates signed by it; if it is lost, every user has to
# reinstall by hand after the key is replaced.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
key_path="${1:-$HOME/.config/lewdev-release/release-signing-key.pem}"
key_ts="$repo_root/packages/core/src/release-key.ts"

case "$(cd "$(dirname "$key_path")" 2>/dev/null && pwd || dirname "$key_path")/" in
  "$repo_root"/*)
    echo "Refusing to write the private key inside the repository." >&2
    exit 1
    ;;
esac
if [ -e "$key_path" ]; then
  echo "$key_path already exists; refusing to overwrite it." >&2
  exit 1
fi

mkdir -p "$(dirname "$key_path")"
chmod 0700 "$(dirname "$key_path")"
(umask 077 && openssl genpkey -algorithm ed25519 -out "$key_path")
chmod 0600 "$key_path"
public_pem="$(openssl pkey -in "$key_path" -pubout)"

{
  cat <<'HEADER'
/**
 * Ed25519 public key (SPKI PEM) that signs lewdev release checksums. The
 * matching private key lives only in the `LEWDEV_RELEASE_SIGNING_KEY` GitHub
 * Actions secret. `scripts/release-keygen.sh` generates the pair and rewrites
 * this value. While it is null, builds cannot verify, so cannot install, updates.
 */
HEADER
  printf 'export const RELEASE_PUBLIC_KEY_PEM: string | null = `%s\n`;\n' "$public_pem"
} > "$key_ts"

cat <<EOF2
Private key: $key_path (back this up; never commit it)
Public key written to: ${key_ts#"$repo_root"/}

Store the private key as an environment secret for the release workflow:
  gh secret set LEWDEV_RELEASE_SIGNING_KEY --env release --repo harlew-dev/lewdev < "$key_path"
EOF2
