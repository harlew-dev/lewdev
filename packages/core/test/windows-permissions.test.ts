import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getConfigPath, saveConfig, savePrivateKey } from "../src/index.js";

test.skipIf(process.platform !== "win32")(
  "Windows credentials inherit access scoped to the current user",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "lewdev acl-"));
    const env = { XDG_CONFIG_HOME: root };
    try {
      await saveConfig({ apiUrl: "https://aerol.example.test", apiToken: "test-token" }, env);
      const key = await savePrivateKey("sb-example", "test key", env);
      const script = Buffer.from(
        `
$ErrorActionPreference = 'Stop'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach ($path in ($env:LEWDEV_TEST_CONFIG, $env:LEWDEV_TEST_KEY)) {
  $acl = Get-Acl -LiteralPath $path
  $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid) {
    throw "Credential file has unexpected access rules: $path"
  }
}
`,
        "utf16le",
      ).toString("base64");
      const result = Bun.spawnSync(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", script],
        {
          env: { ...process.env, LEWDEV_TEST_CONFIG: getConfigPath(env), LEWDEV_TEST_KEY: key },
        },
      );
      expect(result.exitCode, result.stderr.toString()).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000,
);
