import { execFile } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Windows OpenSSH checks ACLs. Protect the directory before writing any
// credentials so new files and subdirectories inherit owner-only access.
const protectWindowsDirectory = Buffer.from(
  `
$ErrorActionPreference = 'Stop'
$path = $env:LEWDEV_PRIVATE_DIR
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$acl = Get-Acl -LiteralPath $path
$acl.SetSecurityDescriptorSddlForm("D:P(A;OICI;FA;;;$sid)", 'Access')
Set-Acl -LiteralPath $path -AclObject $acl
`,
  "utf16le",
).toString("base64");

export async function ensurePrivateDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", protectWindowsDirectory],
      { env: { ...process.env, LEWDEV_PRIVATE_DIR: path }, windowsHide: true },
    );
    return;
  }
  await chmod(path, 0o700);
}
