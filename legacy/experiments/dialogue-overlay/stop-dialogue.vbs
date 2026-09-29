Option Explicit

Dim shell, fileSystem, scriptPath, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
scriptPath = fileSystem.BuildPath(fileSystem.GetParentFolderName(WScript.ScriptFullName), "amiya-dialogue.ps1")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File """ & scriptPath & """ -Stop"
shell.Run command, 0, False
