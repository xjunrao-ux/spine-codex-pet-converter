# Amiya dialogue overlay

Codex custom pet packages do not expose a custom dialogue or speech-bubble script hook. This optional Windows overlay runs beside Codex and displays random dialogue without changing the Codex pet package.

## Use

1. Double-click `start-dialogue.vbs`.
2. The first line appears after `startupDelaySeconds`.
3. Right-click the tray icon to show the next line, pause, or exit.
4. Double-click `stop-dialogue.vbs` to stop it from outside the tray menu.

Edit `dialogue.json` to change the speaker, dialogue lines, timing, or screen position. Restart the overlay after editing the file.

The default bubble position assumes the Codex pet is near the bottom-right corner of the primary monitor. The Codex app does not expose the pet's live screen coordinates, so the overlay cannot automatically follow a pet that is dragged elsewhere.
