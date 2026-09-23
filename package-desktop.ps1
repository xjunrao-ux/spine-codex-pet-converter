$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$electronDist = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '..\node_modules\electron\dist'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$portableRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot 'SpineCodexConverter-Full'))
$appTarget = Join-Path $portableRoot 'resources\app'
$zipPath = Join-Path $releaseRoot 'SpineCodexConverter-Full.zip'

if (-not $portableRoot.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Portable output escaped the release directory.'
}
if (-not (Test-Path -LiteralPath (Join-Path $electronDist 'electron.exe'))) {
    throw 'Electron runtime was not found.'
}

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

New-Item -ItemType Directory -Path $appTarget -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'desktop-app\*') -Destination $appTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination (Join-Path $portableRoot 'README.md') -Force

Compress-Archive -Path (Join-Path $portableRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force

$folderBytes = (Get-ChildItem -LiteralPath $portableRoot -Recurse -File | Measure-Object Length -Sum).Sum
$zip = Get-Item -LiteralPath $zipPath
Write-Host ("Portable folder: {0:N1} MiB" -f ($folderBytes / 1MB))
Write-Host ("ZIP package: {0:N1} MiB" -f ($zip.Length / 1MB))
