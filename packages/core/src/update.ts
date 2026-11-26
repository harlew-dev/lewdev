import { createHash, createPublicKey, verify } from "node:crypto";
import { chmod, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { getConfigDir } from "./config.js";
import { ensurePrivateDir } from "./private-dir.js";
import { RELEASE_PUBLIC_KEY_PEM } from "./release-key.js";

type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const RELEASE_REPO = "harlew-dev/lewdev";
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const CHECKSUMS_ASSET = "SHA256SUMS";
export const SIGNATURE_ASSET = "SHA256SUMS.sig";

const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
const DOWNLOAD_PREFIX = `https://github.com/${RELEASE_REPO}/releases/download/`;
const MAX_METADATA_BYTES = 64 * 1024;
const MAX_BINARY_BYTES = 256 * 1024 * 1024;
const ED25519_SIGNATURE_BYTES = 64;
const USER_AGENT = "lewdev-updater";

export class UpdateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UpdateError";
  }
}

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface ReleaseInfo {
  /** Without the leading `v`, e.g. `0.2.0`. */
  version: string;
  tag: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
}

export interface UpdateCheck {
  currentVersion: string;
  latest: ReleaseInfo;
  /** True when the latest release is newer than the running version. */
  available: boolean;
  /** The release asset for this platform, or null when none is published. */
  assetName: string | null;
}

type Version = [number, number, number];

export function parseVersion(raw: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative when `a < b`, zero when equal, positive when `a > b`. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new UpdateError(`Cannot compare versions ${JSON.stringify(a)} and ${JSON.stringify(b)}.`);
  }
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** The release asset built for a platform, or null when releases do not cover it. */
export function releaseAssetName(
  platform: string = process.platform,
  arch: string = process.arch,
): string | null {
  if ((platform === "linux" || platform === "darwin") && (arch === "x64" || arch === "arm64")) {
    return `lewdev-${platform}-${arch}`;
  }
  if (platform === "win32" && arch === "x64") {
    return "lewdev-windows-x64.exe";
  }
  return null;
}

/** True when running as a `bun build --compile` binary rather than from source. */
export function isStandaloneBuild(main: string = Bun.main): boolean {
  return main.startsWith("/$bunfs/") || main.includes("~BUN");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRelease(body: unknown): ReleaseInfo {
  if (!isRecord(body) || typeof body.tag_name !== "string") {
    throw new UpdateError("GitHub returned an unexpected release response.");
  }
  const version = parseVersion(body.tag_name);
  if (!version) {
    throw new UpdateError(
      `The latest release tag ${JSON.stringify(body.tag_name)} is not a version.`,
    );
  }
  const assets: ReleaseAsset[] = [];
  for (const asset of Array.isArray(body.assets) ? body.assets : []) {
    if (
      !isRecord(asset) ||
      typeof asset.name !== "string" ||
      typeof asset.browser_download_url !== "string" ||
      typeof asset.size !== "number"
    ) {
      continue;
    }
    // Only ever download from this repository's release files.
    if (!asset.browser_download_url.startsWith(`${DOWNLOAD_PREFIX}${body.tag_name}/`)) {
      continue;
    }
    assets.push({ name: asset.name, url: asset.browser_download_url, size: asset.size });
  }
  return {
    version: version.join("."),
    tag: body.tag_name,
    htmlUrl:
      typeof body.html_url === "string"
        ? body.html_url
        : `https://github.com/${RELEASE_REPO}/releases`,
    assets,
  };
}

export async function fetchLatestRelease(fetchImpl: FetchLike = fetch): Promise<ReleaseInfo> {
  let response: Response;
  try {
    response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (error) {
    throw new UpdateError("Could not reach GitHub to check for updates.", { cause: error });
  }
  if (response.status === 404) {
    throw new UpdateError("No lewdev release has been published yet.");
  }
  if (!response.ok) {
    throw new UpdateError(`GitHub returned HTTP ${response.status} while checking for updates.`);
  }
  const body = await readLimited(response, MAX_METADATA_BYTES, "release information");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch (error) {
    throw new UpdateError("GitHub returned an unreadable release response.", { cause: error });
  }
  return parseRelease(parsed);
}

export interface CheckOptions {
  fetch?: FetchLike;
  platform?: string;
  arch?: string;
}

export async function checkForUpdate(
  currentVersion: string,
  options: CheckOptions = {},
): Promise<UpdateCheck> {
  const latest = await fetchLatestRelease(options.fetch);
  const assetName = releaseAssetName(options.platform, options.arch);
  const published =
    assetName !== null && latest.assets.some((asset) => asset.name === assetName)
      ? assetName
      : null;
  return {
    currentVersion,
    latest,
    available: compareVersions(latest.version, currentVersion) > 0,
    assetName: published,
  };
}

/**
 * The exact bytes the release workflow signs. Binding the version into the
 * message stops an older, validly signed release being republished as newer.
 */
export function signedReleaseMessage(version: string, checksums: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`lewdev-release v${version}\n`, "utf8"), checksums]);
}

export function verifyReleaseSignature(
  version: string,
  checksums: Buffer,
  signature: Buffer,
  publicKeyPem: string | null = RELEASE_PUBLIC_KEY_PEM,
): boolean {
  if (!publicKeyPem) {
    throw new UpdateError("This build has no release signing key, so it cannot verify updates.");
  }
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new UpdateError("The release signing key is not an Ed25519 key.");
  }
  if (signature.length !== ED25519_SIGNATURE_BYTES) {
    return false;
  }
  return verify(null, signedReleaseMessage(version, checksums), key, signature);
}

/** Finds the SHA-256 for one file in `sha256sum` output. */
export function expectedChecksum(checksums: string, assetName: string): string {
  const matches: string[] = [];
  for (const line of checksums.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (match?.[2] === assetName && match[1]) {
      matches.push(match[1]);
    }
  }
  if (matches.length !== 1 || !matches[0]) {
    throw new UpdateError(`The release checksums do not list ${assetName} exactly once.`);
  }
  return matches[0];
}

async function readLimited(response: Response, max: number, what: string): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > max) {
    throw new UpdateError(`The ${what} is larger than expected.`);
  }
  if (!response.body) {
    return Buffer.alloc(0);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new UpdateError(`The ${what} is larger than expected.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function download(
  fetchImpl: FetchLike,
  asset: ReleaseAsset,
  max: number,
  what: string,
): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(asset.url, { headers: { "User-Agent": USER_AGENT } });
  } catch (error) {
    throw new UpdateError(`Could not download the ${what}.`, { cause: error });
  }
  if (!response.ok) {
    throw new UpdateError(`GitHub returned HTTP ${response.status} for the ${what}.`);
  }
  return readLimited(response, max, what);
}

export interface DownloadOptions {
  fetch?: FetchLike;
  publicKeyPem?: string | null;
}

/**
 * Downloads this platform's binary from a release and returns its bytes only
 * after the signed checksum list and the binary's SHA-256 both check out.
 */
export async function downloadVerifiedUpdate(
  release: ReleaseInfo,
  assetName: string,
  options: DownloadOptions = {},
): Promise<Buffer> {
  const fetchImpl = options.fetch ?? fetch;
  const find = (name: string): ReleaseAsset => {
    const asset = release.assets.find((candidate) => candidate.name === name);
    if (!asset) {
      throw new UpdateError(`Release ${release.tag} has no ${name} file.`);
    }
    return asset;
  };
  const binaryAsset = find(assetName);
  const checksums = await download(
    fetchImpl,
    find(CHECKSUMS_ASSET),
    MAX_METADATA_BYTES,
    "release checksums",
  );
  const signature = await download(
    fetchImpl,
    find(SIGNATURE_ASSET),
    MAX_METADATA_BYTES,
    "release signature",
  );

  const publicKeyPem =
    options.publicKeyPem === undefined ? RELEASE_PUBLIC_KEY_PEM : options.publicKeyPem;
  if (!verifyReleaseSignature(release.version, checksums, signature, publicKeyPem)) {
    throw new UpdateError(`The signature on release ${release.tag} is not valid. Not updating.`);
  }
  const expected = expectedChecksum(checksums.toString("utf8"), assetName);

  const binary = await download(fetchImpl, binaryAsset, MAX_BINARY_BYTES, "update");
  const actual = createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new UpdateError(`The downloaded ${assetName} does not match its checksum. Not updating.`);
  }
  return binary;
}

function isPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

/** Where a Windows update parks the running executable until the next start. */
export function previousBinaryPath(target: string): string {
  return `${target}.old`;
}

/**
 * Replaces the executable at `targetPath` (following symlinks) with `binary`.
 * The new file is written beside the target first, so a failure leaves the
 * old binary in place. On Unix it is renamed over the target atomically.
 * Windows cannot overwrite a running .exe, so the old one is renamed aside to
 * `<target>.old` (removed by `cleanupPreviousBinary` on a later start) and put
 * back if the swap fails.
 */
export async function installUpdate(
  binary: Buffer,
  targetPath: string = process.execPath,
  platform: string = process.platform,
): Promise<string> {
  const target = await realpath(targetPath);
  const tmpPath = join(dirname(target), `.${basename(target)}.update-${process.pid}-${Date.now()}`);
  try {
    // Write and flush through one writable handle: Windows refuses to fsync a
    // file opened read-only.
    const handle = await open(tmpPath, "wx", 0o755);
    try {
      await handle.writeFile(binary);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (platform === "win32") {
      const previous = previousBinaryPath(target);
      await rm(previous, { force: true });
      await rename(target, previous);
      try {
        await rename(tmpPath, target);
      } catch (error) {
        await rename(previous, target).catch(() => {});
        throw error;
      }
    } else {
      await chmod(tmpPath, 0o755);
      await rename(tmpPath, target);
    }
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    if (isPermissionError(error)) {
      const hint =
        platform === "win32"
          ? "Run it from an elevated terminal, or reinstall lewdev to a folder you own."
          : "Run `sudo lewdev update`, or reinstall lewdev to a directory you own.";
      throw new UpdateError(`No permission to replace ${target}. ${hint}`, { cause: error });
    }
    throw new UpdateError(`Could not replace ${target}.`, { cause: error });
  }
  return target;
}

/** Best-effort removal of the executable a Windows update renamed aside. */
export async function cleanupPreviousBinary(targetPath: string = process.execPath): Promise<void> {
  try {
    await rm(previousBinaryPath(await realpath(targetPath)), { force: true });
  } catch {
    // Still locked or already gone; a later start will try again.
  }
}

export interface UpdateState {
  checkedAt?: string;
  latestVersion?: string;
}

export function getUpdateStatePath(env: Env = process.env): string {
  return join(getConfigDir(env), "update-check.json");
}

export async function readUpdateState(env: Env = process.env): Promise<UpdateState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(getUpdateStatePath(env), "utf8"));
    if (!isRecord(parsed)) {
      return {};
    }
    const state: UpdateState = {};
    if (typeof parsed.checkedAt === "string") {
      state.checkedAt = parsed.checkedAt;
    }
    if (typeof parsed.latestVersion === "string" && parseVersion(parsed.latestVersion)) {
      state.latestVersion = parsed.latestVersion;
    }
    return state;
  } catch {
    return {};
  }
}

export async function writeUpdateState(state: UpdateState, env: Env = process.env): Promise<void> {
  const path = getUpdateStatePath(env);
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await ensurePrivateDir(getConfigDir(env));
    await writeFile(tmpPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, path);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

export interface UpdateNotice {
  currentVersion: string;
  latestVersion: string;
}

export interface BackgroundCheckOptions extends CheckOptions {
  env?: Env;
  now?: Date;
}

/**
 * The startup check: at most one GitHub request per day, cached in the config
 * directory. Returns a notice when a newer release exists and null otherwise.
 * Never throws; set `LEWDEV_NO_UPDATE_CHECK=1` to turn it off.
 */
export async function backgroundUpdateCheck(
  currentVersion: string,
  options: BackgroundCheckOptions = {},
): Promise<UpdateNotice | null> {
  const env = options.env ?? process.env;
  const flag = env.LEWDEV_NO_UPDATE_CHECK?.trim();
  if (flag && flag !== "0") {
    return null;
  }
  const now = options.now ?? new Date();
  const notice = (latestVersion: string | undefined): UpdateNotice | null => {
    if (!latestVersion) {
      return null;
    }
    try {
      return compareVersions(latestVersion, currentVersion) > 0
        ? { currentVersion, latestVersion }
        : null;
    } catch {
      return null;
    }
  };

  const state = await readUpdateState(env);
  const checkedAt = state.checkedAt ? Date.parse(state.checkedAt) : Number.NaN;
  const age = now.getTime() - checkedAt;
  if (Number.isFinite(checkedAt) && age >= 0 && age < UPDATE_CHECK_INTERVAL_MS) {
    return notice(state.latestVersion);
  }

  try {
    const check = await checkForUpdate(currentVersion, options);
    await writeUpdateState(
      { checkedAt: now.toISOString(), latestVersion: check.latest.version },
      env,
    ).catch(() => {});
    return check.assetName ? notice(check.latest.version) : null;
  } catch {
    return notice(state.latestVersion);
  }
}
