# Releasing

## One-time setup

Run `scripts/release-keygen.sh`. It writes the public key into `packages/core/src/release-key.ts` and prints the `gh secret set` command that stores the private key as the `LEWDEV_RELEASE_SIGNING_KEY` secret of the `release` environment. Back that key up: installed copies only accept updates it signed.

## Each release

1. Bump the version in `package.json`, `apps/tui/package.json` and `packages/core/package.json`, run `bun run check`, commit, push `main` and wait for CI (Linux, Windows and macOS).
2. Push an annotated tag whose message is the release title:

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z: <what changed>"
   git push origin vX.Y.Z
   ```

3. The release workflow checks that the tag matches the package version, then builds and smoke-tests the Linux, macOS and Windows x64 binaries. It signs `SHA256SUMS` and uploads everything to a **draft** release.
4. Download the draft and check it: seven files (five binaries, `SHA256SUMS`, `SHA256SUMS.sig`), `sha256sum -c SHA256SUMS` passes, and the signature verifies.
5. Publish it with the written notes:

   ```sh
   gh release edit vX.Y.Z --title "vX.Y.Z: …" --notes-file notes.md --draft=false --latest
   ```

Never move or delete the tag of a published release, and never replace its files. Fix forward with the next patch release.
