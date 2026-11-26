# Install lewdev from GitHub releases on Windows x64.
#
#   irm https://raw.githubusercontent.com/harlew-dev/lewdev/main/install.ps1 | iex
#
# Set LEWDEV_VERSION=0.2.0 to install a specific release, or LEWDEV_INSTALL_DIR
# to choose where the binary goes (default: %LOCALAPPDATA%\Programs\lewdev).
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 downloads very slowly while drawing a progress bar.
$ProgressPreference = 'SilentlyContinue'

$repo = 'harlew-dev/lewdev'
$tempDir = $null

function Fail([string]$message) {
    throw "lewdev install: $message"
}

try {
    $arch = if ($env:PROCESSOR_ARCHITEW6432) {
        $env:PROCESSOR_ARCHITEW6432
    } else {
        $env:PROCESSOR_ARCHITECTURE
    }
    if ((-not [Environment]::Is64BitOperatingSystem) -or ($arch -ne 'AMD64')) {
        Fail "unsupported architecture '$arch'; Windows x64 is required."
    }

    $asset = 'lewdev-windows-x64.exe'
    if ($env:LEWDEV_VERSION) {
        $version = $env:LEWDEV_VERSION.TrimStart('v')
        if (-not $version) {
            Fail 'LEWDEV_VERSION is empty.'
        }
        $base = "https://github.com/$repo/releases/download/v$version"
    } else {
        $base = "https://github.com/$repo/releases/latest/download"
    }

    $installDir = if ($env:LEWDEV_INSTALL_DIR) {
        $env:LEWDEV_INSTALL_DIR
    } else {
        Join-Path $env:LOCALAPPDATA 'Programs\lewdev'
    }

    $tempDir = Join-Path ([IO.Path]::GetTempPath()) ("lewdev-install-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    $downloadPath = Join-Path $tempDir $asset
    $sumsPath = Join-Path $tempDir 'SHA256SUMS'

    Write-Host "Downloading $asset..."
    Invoke-WebRequest -Uri "$base/$asset" -OutFile $downloadPath -UseBasicParsing
    Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile $sumsPath -UseBasicParsing

    $line = Get-Content -LiteralPath $sumsPath |
        Where-Object {
            $parts = $_ -split '\s+'
            $parts.Count -ge 2 -and $parts[1].TrimStart('*') -eq $asset
        } |
        Select-Object -First 1
    if (-not $line) {
        Fail "SHA256SUMS does not list $asset."
    }
    $expected = (($line -split '\s+')[0]).ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        Fail 'checksum mismatch; not installing.'
    }

    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    $target = Join-Path $installDir 'lewdev.exe'
    $installTemp = Join-Path $installDir ('.lewdev-install-' + [guid]::NewGuid().ToString('N') + '.exe')
    Copy-Item -LiteralPath $downloadPath -Destination $installTemp -Force
    Move-Item -LiteralPath $installTemp -Destination $target -Force
    Write-Host "Installed lewdev to $target"

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $alreadyOnPath = $false
    foreach ($entry in @($userPath -split ';')) {
        if ($entry -and $entry.TrimEnd('\') -ieq $installDir.TrimEnd('\')) {
            $alreadyOnPath = $true
        }
    }
    if (-not $alreadyOnPath) {
        $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
            $installDir
        } else {
            $userPath.TrimEnd(';') + ';' + $installDir
        }
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Host "Added $installDir to your user PATH. Open a new terminal to use lewdev."
    }
} catch {
    # No `exit` here: under `irm | iex` it would close the user's PowerShell window.
    [Console]::Error.WriteLine($_.Exception.Message)
} finally {
    if ($tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
