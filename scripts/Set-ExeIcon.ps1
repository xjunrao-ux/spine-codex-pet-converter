param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath,

    [Parameter(Mandatory = $true)]
    [string]$IconPath
)

$ErrorActionPreference = 'Stop'

$resolvedExecutable = [System.IO.Path]::GetFullPath($ExecutablePath)
$resolvedIcon = [System.IO.Path]::GetFullPath($IconPath)

if (-not (Test-Path -LiteralPath $resolvedExecutable -PathType Leaf)) {
    throw "Executable not found: $resolvedExecutable"
}
if (-not (Test-Path -LiteralPath $resolvedIcon -PathType Leaf)) {
    throw "Icon not found: $resolvedIcon"
}

if (-not ('NativeIconResource' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class NativeIconResource
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr BeginUpdateResource(string fileName, bool deleteExistingResources);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateResource(
        IntPtr updateHandle,
        IntPtr type,
        IntPtr name,
        ushort language,
        byte[] data,
        uint dataSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool EndUpdateResource(IntPtr updateHandle, bool discard);

    private static IntPtr ResourceId(int value)
    {
        return new IntPtr(value);
    }

    public static void ReplaceIcon(string executablePath, byte[][] images, byte[] groupData)
    {
        IntPtr handle = BeginUpdateResource(executablePath, false);
        if (handle == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "BeginUpdateResource failed.");

        bool discard = true;
        try
        {
            for (int index = 0; index < images.Length; index++)
            {
                byte[] image = images[index];
                if (!UpdateResource(handle, ResourceId(3), ResourceId(index + 1), 0, image, (uint)image.Length))
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "Updating RT_ICON failed.");
            }

            if (!UpdateResource(handle, ResourceId(14), ResourceId(1), 0, groupData, (uint)groupData.Length))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Updating RT_GROUP_ICON failed.");

            discard = false;
        }
        finally
        {
            if (!EndUpdateResource(handle, discard) && !discard)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "EndUpdateResource failed.");
        }
    }
}
'@
}

$iconBytes = [System.IO.File]::ReadAllBytes($resolvedIcon)
if ($iconBytes.Length -lt 6 -or [BitConverter]::ToUInt16($iconBytes, 0) -ne 0 -or [BitConverter]::ToUInt16($iconBytes, 2) -ne 1) {
    throw 'The input is not a valid Windows ICO file.'
}

$count = [BitConverter]::ToUInt16($iconBytes, 4)
if ($count -lt 1) {
    throw 'The ICO file contains no images.'
}

$images = New-Object 'byte[][]' $count
$groupStream = New-Object System.IO.MemoryStream
$groupWriter = New-Object System.IO.BinaryWriter($groupStream)
$groupWriter.Write([UInt16]0)
$groupWriter.Write([UInt16]1)
$groupWriter.Write([UInt16]$count)

for ($index = 0; $index -lt $count; $index++) {
    $entryOffset = 6 + (16 * $index)
    if ($entryOffset + 16 -gt $iconBytes.Length) {
        throw 'The ICO directory is truncated.'
    }

    $imageSize = [BitConverter]::ToUInt32($iconBytes, $entryOffset + 8)
    $imageOffset = [BitConverter]::ToUInt32($iconBytes, $entryOffset + 12)
    if ([UInt64]$imageOffset + [UInt64]$imageSize -gt [UInt64]$iconBytes.Length) {
        throw 'An ICO image entry points outside the file.'
    }

    $image = New-Object byte[] $imageSize
    [Array]::Copy($iconBytes, [int]$imageOffset, $image, 0, [int]$imageSize)
    $images[$index] = $image

    $groupWriter.Write($iconBytes[$entryOffset])
    $groupWriter.Write($iconBytes[$entryOffset + 1])
    $groupWriter.Write($iconBytes[$entryOffset + 2])
    $groupWriter.Write($iconBytes[$entryOffset + 3])
    $groupWriter.Write([BitConverter]::ToUInt16($iconBytes, $entryOffset + 4))
    $groupWriter.Write([BitConverter]::ToUInt16($iconBytes, $entryOffset + 6))
    $groupWriter.Write([UInt32]$imageSize)
    $groupWriter.Write([UInt16]($index + 1))
}

$groupWriter.Flush()
$groupData = $groupStream.ToArray()
$groupWriter.Dispose()
$groupStream.Dispose()

[NativeIconResource]::ReplaceIcon($resolvedExecutable, $images, $groupData)
Write-Host "Applied icon: $resolvedExecutable"
