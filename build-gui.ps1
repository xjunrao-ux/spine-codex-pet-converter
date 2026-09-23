$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $projectRoot 'gui\SpineCodexConverterGui.cs'
$output = Join-Path $projectRoot 'SpineCodexConverter.exe'
$compilerCandidates = @(
    "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $compiler) {
    throw 'The .NET Framework C# compiler (csc.exe) was not found.'
}

& $compiler /nologo /target:winexe /optimize+ /platform:anycpu `
    /reference:System.dll `
    /reference:System.Core.dll `
    /reference:System.Drawing.dll `
    /reference:System.Windows.Forms.dll `
    /out:$output `
    $source

if ($LASTEXITCODE -ne 0) {
    throw "GUI compilation failed with exit code $LASTEXITCODE"
}

$file = Get-Item -LiteralPath $output
Write-Host ("Created: {0} ({1:N0} bytes)" -f $file.FullName, $file.Length)
