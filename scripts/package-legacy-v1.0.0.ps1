$ErrorActionPreference = 'Stop'

$tag = 'v1.0.0'
$version = '1.0.0'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "SpineCodexConverter-Lightweight-v$version"))
$temporaryRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot ".tmp-lightweight-v$version"))
$snapshotPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot ".tmp-lightweight-v$version.zip"))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "SpineCodexConverter-Lightweight-v$version.zip"))
$checksumPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "SHA256SUMS-v$version.txt"))

foreach ($path in @($stageRoot, $temporaryRoot, $snapshotPath, $zipPath, $checksumPath)) {
    if (-not $path.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Release output escaped the release directory: $path"
    }
}

$selectedPaths = @(
    'build-gui.ps1',
    'codex-pet.config.example.json',
    'convert-spine.cmd',
    'gui',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'renderer.html',
    'scripts\browser-entry.js',
    'scripts\convert-spine.mjs',
    'scripts\validate.mjs'
)

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

try {
    & git -C $projectRoot rev-parse --verify "$tag^{commit}" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Git tag $tag was not found." }

    foreach ($path in @($stageRoot, $temporaryRoot)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }
    foreach ($path in @($snapshotPath, $zipPath)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    & git -C $projectRoot archive --format=zip --output=$snapshotPath $tag
    if ($LASTEXITCODE -ne 0) { throw "Failed to archive Git tag $tag." }

    Expand-Archive -LiteralPath $snapshotPath -DestinationPath $temporaryRoot -Force
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

    foreach ($relativePath in $selectedPaths) {
        $sourcePath = Join-Path $temporaryRoot $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Expected historical file was not found: $relativePath"
        }
        $destinationPath = Join-Path $stageRoot $relativePath
        $destinationParent = Split-Path -Parent $destinationPath
        New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
    }

    Copy-Item -LiteralPath (Join-Path $projectRoot 'legacy\v1.0.0-lightweight\package.json') -Destination (Join-Path $stageRoot 'package.json') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\RELEASE_v1.0.0.md') -Destination (Join-Path $stageRoot 'README.md') -Force

    & (Join-Path $stageRoot 'build-gui.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Historical GUI compilation failed.' }

    Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $checksumLine = "$zipHash  $([System.IO.Path]::GetFileName($zipPath))`n"
    [System.IO.File]::WriteAllText($checksumPath, $checksumLine, [System.Text.UTF8Encoding]::new($false))
    $zip = Get-Item -LiteralPath $zipPath
    Write-Host ("Historical ZIP: {0} ({1:N1} MiB)" -f $zip.FullName, ($zip.Length / 1MB))
    Write-Host "SHA-256: $checksumPath"
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $snapshotPath) {
        Remove-Item -LiteralPath $snapshotPath -Force
    }
}
