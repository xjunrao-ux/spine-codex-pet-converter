@echo off
setlocal

if "%~1"=="" (
  echo Drag a folder containing matching .skel, .atlas and texture files onto this file.
  echo.
  echo Or run:
  echo   convert-spine.cmd "D:\path\to\model-folder"
  pause
  exit /b 1
)

set "INPUT_DIR=%~1"
set "OUTPUT_DIR=%INPUT_DIR%\codex-pet-output"

node "%~dp0scripts\convert-spine.mjs" --input "%INPUT_DIR%" --output "%OUTPUT_DIR%"
if errorlevel 1 (
  echo.
  echo Conversion failed. See the message above.
  pause
  exit /b 1
)

echo.
echo Conversion complete:
echo   %OUTPUT_DIR%
pause
