import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  backgroundUpdateCheck,
  checkForUpdate,
  compareVersions,
  downloadVerifiedUpdate,
  expectedChecksum,
  installUpdate,
  cleanupPreviousBinary,
  previousBinaryPath,
  isStandaloneBuild,
  readUpdateState,
  releaseAssetName,
  signedReleaseMessage,
  UpdateError,
  verifyReleaseSignature,
} from "../src/index.js";

const REPO_DOWNLOAD = "https://github.com/harlew-dev/lewdev/releases/download";
const ASSET = "lewdev-linux-x64";
const posix = process.platform !== "win32";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
const other = generateKeyPairSync("ed25519");
const OTHER_PUBLIC_PEM = other.publicKey.export({ type: "spki", format: "pem" }).toString();

interface FakeRelease {
  version: string;
  binary: Buffer;
  checksums?: Buffer;
  signature?: Buffer;
  /** Version used when signing; defaults to `version`. */
  signedVersion?: string;
  assetUrlBase?: string;
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function releaseFiles(release: FakeRelease): Map<string, Buffer> {
  const checksums =
    release.checksums ??
    Buffer.from(`${sha256(release.binary)}  ${ASSET}\n${"0".repeat(64)}  lewdev-linux-arm64\n`);
  const signature =
    release.signature ??
    sign(
      null,
      signedReleaseMessage(release.signedVersion ?? release.version, checksums),
      privateKey,
    );
  return new Map([
    [ASSET, release.binary],
    ["SHA256SUMS", checksums],
    ["SHA256SUMS.sig", signature],
  ]);
}

function fakeFetch(release: FakeRelease, calls: string[] = []) {
  const tag = `v${release.version}`;
  const base = release.assetUrlBase ?? `${REPO_DOWNLOAD}/${tag}`;
  const files = releaseFiles(release);
  return async (url: string): Promise<Response> => {
    calls.push(url);
    if (url === "https://api.github.com/repos/harlew-dev/lewdev/releases/latest") {
      return Response.json({
        tag_name: tag,
        html_url: `https://github.com/harlew-dev/lewdev/releases/tag/${tag}`,
        assets: [...files.entries()].map(([name, data]) => ({
          name,
          browser_download_url: `${base}/${name}`,
          size: data.length,
        })),
      });
    }
    for (const [name, data] of files) {
      if (url === `${base}/${name}`) {
        return new Response(data);
      }
    }
    return new Response("not found", { status: 404 });
  };
}

describe("versions", () => {
  test("compares semantic versions numerically", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3", "1.3.0")).toBeLessThan(0);
    expect(() => compareVersions("1.2", "1.2.0")).toThrow(UpdateError);
  });

  test("maps each released platform to its asset", () => {
    expect(releaseAssetName("linux", "x64")).toBe("lewdev-linux-x64");
    expect(releaseAssetName("linux", "arm64")).toBe("lewdev-linux-arm64");
    expect(releaseAssetName("darwin", "arm64")).toBe("lewdev-darwin-arm64");
    expect(releaseAssetName("darwin", "x64")).toBe("lewdev-darwin-x64");
    expect(releaseAssetName("win32", "x64")).toBe("lewdev-windows-x64.exe");
    expect(releaseAssetName("win32", "arm64")).toBeNull();
    expect(releaseAssetName("freebsd", "x64")).toBeNull();
  });

  test("detects compiled binaries from Bun.main", () => {
    expect(isStandaloneBuild("/$bunfs/root/lewdev")).toBe(true);
    expect(isStandaloneBuild("B:/~BUN/root/lewdev.exe")).toBe(true);
    expect(isStandaloneBuild("/home/me/lewdev/apps/tui/src/index.tsx")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  test("reports a newer release with a matching asset", async () => {
    const check = await checkForUpdate("0.1.0", {
      fetch: fakeFetch({ version: "0.2.0", binary: Buffer.from("new") }),
      platform: "linux",
      arch: "x64",
    });
    expect(check.available).toBe(true);
    expect(check.latest.version).toBe("0.2.0");
    expect(check.assetName).toBe(ASSET);
  });

  test("ignores assets hosted outside this repository's release", async () => {
    const check = await checkForUpdate("0.1.0", {
      fetch: fakeFetch({
        version: "0.2.0",
        binary: Buffer.from("new"),
        assetUrlBase: "https://evil.example/download/v0.2.0",
      }),
      platform: "linux",
      arch: "x64",
    });
    expect(check.latest.assets).toHaveLength(0);
    expect(check.assetName).toBeNull();
  });

  test("is not available when already current", async () => {
    const check = await checkForUpdate("0.2.0", {
      fetch: fakeFetch({ version: "0.2.0", binary: Buffer.from("same") }),
      platform: "linux",
      arch: "x64",
    });
    expect(check.available).toBe(false);
  });
});

describe("signature and checksums", () => {
  test("verifies a signature bound to the version", () => {
    const sums = Buffer.from("abc\n");
    const signature = sign(null, signedReleaseMessage("1.0.0", sums), privateKey);
    expect(verifyReleaseSignature("1.0.0", sums, signature, PUBLIC_PEM)).toBe(true);
    expect(verifyReleaseSignature("1.0.1", sums, signature, PUBLIC_PEM)).toBe(false);
    expect(verifyReleaseSignature("1.0.0", Buffer.from("abd\n"), signature, PUBLIC_PEM)).toBe(
      false,
    );
    expect(verifyReleaseSignature("1.0.0", sums, signature, OTHER_PUBLIC_PEM)).toBe(false);
    expect(verifyReleaseSignature("1.0.0", sums, signature.subarray(0, 10), PUBLIC_PEM)).toBe(
      false,
    );
  });

  test("refuses to verify without a configured key", () => {
    expect(() => verifyReleaseSignature("1.0.0", Buffer.from(""), Buffer.alloc(64), null)).toThrow(
      UpdateError,
    );
  });

  test("finds exactly one checksum per asset", () => {
    const hash = "a".repeat(64);
    expect(expectedChecksum(`${hash}  ${ASSET}\n`, ASSET)).toBe(hash);
    expect(expectedChecksum(`${hash} *${ASSET}\n`, ASSET)).toBe(hash);
    expect(() => expectedChecksum(`${hash}  other\n`, ASSET)).toThrow(UpdateError);
    expect(() => expectedChecksum(`${hash}  ${ASSET}\n${hash}  ${ASSET}\n`, ASSET)).toThrow(
      UpdateError,
    );
  });
});

describe("downloadVerifiedUpdate", () => {
  async function latest(release: FakeRelease) {
    const fetch = fakeFetch(release);
    const check = await checkForUpdate("0.1.0", { fetch, platform: "linux", arch: "x64" });
    return { fetch, release: check.latest };
  }

  test("returns the binary when signature and checksum match", async () => {
    const binary = Buffer.from("new binary");
    const { fetch, release } = await latest({ version: "0.2.0", binary });
    const bytes = await downloadVerifiedUpdate(release, ASSET, { fetch, publicKeyPem: PUBLIC_PEM });
    expect(bytes.equals(binary)).toBe(true);
  });

  test("rejects a release signed by another key", async () => {
    const { fetch, release } = await latest({ version: "0.2.0", binary: Buffer.from("x") });
    await expect(
      downloadVerifiedUpdate(release, ASSET, { fetch, publicKeyPem: OTHER_PUBLIC_PEM }),
    ).rejects.toThrow(/signature/);
  });

  test("rejects an old signed release relabelled as newer", async () => {
    const { fetch, release } = await latest({
      version: "0.3.0",
      signedVersion: "0.2.0",
      binary: Buffer.from("old"),
    });
    await expect(
      downloadVerifiedUpdate(release, ASSET, { fetch, publicKeyPem: PUBLIC_PEM }),
    ).rejects.toThrow(/signature/);
  });

  test("rejects a binary that does not match the signed checksum", async () => {
    const checksums = Buffer.from(`${sha256(Buffer.from("expected"))}  ${ASSET}\n`);
    const { fetch, release } = await latest({
      version: "0.2.0",
      binary: Buffer.from("tampered"),
      checksums,
    });
    await expect(
      downloadVerifiedUpdate(release, ASSET, { fetch, publicKeyPem: PUBLIC_PEM }),
    ).rejects.toThrow(/checksum/);
  });

  test("does not download the binary before the signature checks out", async () => {
    const calls: string[] = [];
    const fetch = fakeFetch(
      { version: "0.2.0", binary: Buffer.from("x"), signature: Buffer.alloc(64) },
      calls,
    );
    const check = await checkForUpdate("0.1.0", { fetch, platform: "linux", arch: "x64" });
    await expect(
      downloadVerifiedUpdate(check.latest, ASSET, { fetch, publicKeyPem: PUBLIC_PEM }),
    ).rejects.toThrow(UpdateError);
    expect(calls.some((url) => url.endsWith(`/${ASSET}`))).toBe(false);
  });
});

describe("installUpdate", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lewdev-update-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test.skipIf(!posix)("replaces the target, through symlinks, as an executable", async () => {
    const target = join(root, "lewdev-real");
    const link = join(root, "lewdev");
    await writeFile(target, "old", { mode: 0o755 });
    await symlink(target, link);

    const replaced = await installUpdate(Buffer.from("new"), link);

    expect(replaced).toBe(target);
    expect(await readFile(target, "utf8")).toBe("new");
    expect((await stat(target)).mode & 0o777).toBe(0o755);
    expect((await stat(link)).isFile()).toBe(true);
  });

  test("the Windows path parks the old binary and cleanup removes it", async () => {
    const target = join(root, "lewdev.exe");
    await writeFile(target, "old");

    await installUpdate(Buffer.from("new"), target, "win32");

    expect(await readFile(target, "utf8")).toBe("new");
    expect(await readFile(previousBinaryPath(target), "utf8")).toBe("old");
    await cleanupPreviousBinary(target);
    await expect(stat(previousBinaryPath(target))).rejects.toThrow();
  });
});

describe("backgroundUpdateCheck", () => {
  let root = "";
  let env: Record<string, string> = {};

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lewdev-update-state-"));
    env = { XDG_CONFIG_HOME: root };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const options = (fetch: (url: string) => Promise<Response>, now: Date) => ({
    env,
    now,
    fetch,
    platform: "linux",
    arch: "x64",
  });

  test("checks at most once a day and caches the latest version", async () => {
    const calls: string[] = [];
    const fetch = fakeFetch({ version: "0.2.0", binary: Buffer.from("x") }, calls);
    const now = new Date("2026-11-26T10:00:00Z");

    expect(await backgroundUpdateCheck("0.1.0", options(fetch, now))).toEqual({
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
    });
    const later = new Date("2026-11-26T20:00:00Z");
    expect(await backgroundUpdateCheck("0.1.0", options(fetch, later))).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect((await readUpdateState(env)).latestVersion).toBe("0.2.0");
    if (posix) {
      const statePath = join(root, "lewdev", "update-check.json");
      expect((await stat(statePath)).mode & 0o777).toBe(0o600);
    }
  });

  test("never throws when GitHub cannot be reached", async () => {
    const fetch = async (): Promise<Response> => {
      throw new Error("offline");
    };
    expect(await backgroundUpdateCheck("0.1.0", options(fetch, new Date()))).toBeNull();
  });

  test("can be turned off with LEWDEV_NO_UPDATE_CHECK", async () => {
    const calls: string[] = [];
    const fetch = fakeFetch({ version: "0.2.0", binary: Buffer.from("x") }, calls);
    env.LEWDEV_NO_UPDATE_CHECK = "1";
    expect(await backgroundUpdateCheck("0.1.0", options(fetch, new Date()))).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
