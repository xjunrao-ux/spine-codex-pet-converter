$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$electronDist = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '..\node_modules\electron\dist'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$packageMetadata = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$packageMetadata.version
$portableRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "SpineCodexConverter-Full-v$version"))
$appTarget = Join-Path $portableRoot 'resources\app'
$zipPath = Join-Path $releaseRoot "SpineCodexConverter-Full-v$version.zip"
$checksumPath = Join-Path $releaseRoot "SHA256SUMS-v$version.txt"
$iconPath = Join-Path $projectRoot 'desktop-app\assets\app-icon.ico'
$iconBuilder = Join-Path $projectRoot 'scripts\build-icon.mjs'
$iconWriter = Join-Path $projectRoot 'scripts\Set-ExeIcon.ps1'

if (-not $portableRoot.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Portable output escaped the release directory.'
}
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Invalid package version: $version"
}
if (-not (Test-Path -LiteralPath (Join-Path $electronDist 'electron.exe'))) {
    throw 'Electron runtime was not found.'
}

& node $iconBuilder
if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }

& node (Join-Path $projectRoot 'desktop\build-desktop.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop renderer build failed.' }

if (Test-Path -LiteralPath $portableRoot) {
    Remove-Item -LiteralPath $portableRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null
Copy-Item -Path (Join-Path $electronDist '*') -Destination $portableRoot -Recurse -Force

$electronExe = Join-Path $portableRoot 'electron.exe'
$productExe = Join-Path $portableRoot 'SpineCodexConverter.exe'
Move-Item -LiteralPath $electronExe -Destination $productExe -Force
& $iconWriter -ExecutablePath $productExe -IconPath $iconPath

New-Item -ItemType Directory -Path $appTarget -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'desktop-app\*') -Destination $appTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination (Join-Path $portableRoot 'README.md') -Force

Compress-Archive -Path (Join-Path $portableRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumLine = "$zipHash  $([System.IO.Path]::GetFileName($zipPath))`n"
[System.IO.File]::WriteAllText($checksumPath, $checksumLine, [System.Text.UTF8Encoding]::new($false))

$folderBytes = (Get-ChildItem -LiteralPath $portableRoot -Recurse -File | Measure-Object Length -Sum).Sum
$zip = Get-Item -LiteralPath $zipPath
Write-Host ("Portable folder: {0:N1} MiB" -f ($folderBytes / 1MB))
Write-Host ("ZIP package: {0:N1} MiB" -f ($zip.Length / 1MB))
Write-Host "SHA-256: $checksumPath"
