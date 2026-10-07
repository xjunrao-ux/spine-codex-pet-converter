param(
    # For local verification only; normal releases use _local/releases/vX.Y.Z.
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..'))
$electronDist = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'node_modules\electron\dist'))
$packageMetadata = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$packageMetadata.version
$releaseRoot = if ($OutputRoot) {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputRoot))
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot "_local\releases\v$version"))
}
$localPrefix = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '_local')).TrimEnd('\') + '\'
if (-not $releaseRoot.StartsWith($localPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package output must stay inside the project _local directory.'
}
$portableRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "SpineCodexConverter-Full-v$version"))
$appTarget = Join-Path $portableRoot 'resources\app'
$zipPath = Join-Path $releaseRoot "SpineCodexConverter-Full-v$version.zip"
$checksumPath = Join-Path $releaseRoot "SHA256SUMS-v$version.txt"
$iconPath = Join-Path $projectRoot 'src\app\assets\app-icon.ico'
$iconBuilder = Join-Path $projectRoot 'scripts\build-icon.mjs'
$iconWriter = Join-Path $projectRoot 'scripts\Set-ExeIcon.ps1'

if (-not $portableRoot.StartsWith(($releaseRoot.TrimEnd('\') + '\'), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Portable output escaped the release directory.'
}
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Invalid package version: $version"
}
$appMetadata = Get-Content -LiteralPath (Join-Path $projectRoot 'src\app\package.json') -Raw | ConvertFrom-Json
if ($appMetadata.version -ne $version) { throw 'Root and application versions must match.' }
if ((Test-Path -LiteralPath $zipPath) -or (Test-Path -LiteralPath $portableRoot) -or (Test-Path -LiteralPath $checksumPath)) {
    throw "Release v$version already exists. Keep published artifacts immutable; choose a new version before packaging."
}
if (-not (Test-Path -LiteralPath (Join-Path $electronDist 'electron.exe'))) {
    throw 'Electron runtime was not found.'
}

& node $iconBuilder
if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }

& node (Join-Path $projectRoot 'scripts\build-desktop.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop renderer build failed.' }

New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null
Copy-Item -Path (Join-Path $electronDist '*') -Destination $portableRoot -Recurse -Force

$electronExe = Join-Path $portableRoot 'electron.exe'
$productExe = Join-Path $portableRoot 'SpineCodexConverter.exe'
Move-Item -LiteralPath $electronExe -Destination $productExe -Force
& $iconWriter -ExecutablePath $productExe -IconPath $iconPath

New-Item -ItemType Directory -Path $appTarget -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'src\app\*') -Destination $appTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\PORTABLE.md') -Destination (Join-Path $portableRoot 'README.md') -Force
# Rewrite source-tree links so the portable guide and template work after extraction.
$usage = Get-Content -LiteralPath (Join-Path $projectRoot 'docs\USAGE.md') -Raw
$usage = $usage.Replace('../README.md#', 'https://github.com/xjunrao-ux/spine-codex-pet-converter#')
$usage = $usage.Replace('../examples/', 'examples/')
$usage = $usage.Replace('(ARCHIVE.md)', '(https://github.com/xjunrao-ux/spine-codex-pet-converter/blob/main/docs/ARCHIVE.md)')
[System.IO.File]::WriteAllText((Join-Path $portableRoot 'USAGE.md'), $usage, [System.Text.UTF8Encoding]::new($false))
$examplesTarget = Join-Path $portableRoot 'examples'
New-Item -ItemType Directory -Path $examplesTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'examples\codex-pet.config.example.json') -Destination $examplesTarget -Force

Compress-Archive -Path (Join-Path $portableRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumLine = "$zipHash  $([System.IO.Path]::GetFileName($zipPath))`n"
[System.IO.File]::WriteAllText($checksumPath, $checksumLine, [System.Text.UTF8Encoding]::new($false))

$folderBytes = (Get-ChildItem -LiteralPath $portableRoot -Recurse -File | Measure-Object Length -Sum).Sum
$zip = Get-Item -LiteralPath $zipPath
Write-Host ("Portable folder: {0:N1} MiB" -f ($folderBytes / 1MB))
Write-Host ("ZIP package: {0:N1} MiB" -f ($zip.Length / 1MB))
Write-Host "SHA-256: $checksumPath"
