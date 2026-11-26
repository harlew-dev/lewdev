/**
 * Ed25519 public key (SPKI PEM) that signs lewdev release checksums. The
 * matching private key lives only in the `LEWDEV_RELEASE_SIGNING_KEY` GitHub
 * Actions secret. `scripts/release-keygen.sh` generates the pair and rewrites
 * this value. While it is null, builds cannot verify, so cannot install, updates.
 */
export const RELEASE_PUBLIC_KEY_PEM: string | null = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAmtDJWPrTmsoNqVnR/HSJgoMjg6E0A7vLokkFAOgZbu0=
-----END PUBLIC KEY-----
`;
