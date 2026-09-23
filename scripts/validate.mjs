import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";

import sharp from "sharp";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirIndex = process.argv.indexOf("--dir");
const outputDir = dirIndex >= 0
  ? path.resolve(process.argv[dirIndex + 1])
  : path.join(projectDir, "dist");
const spritesheet = path.join(outputDir, "spritesheet.webp");
const manifestPath = path.join(outputDir, "pet.json");
const metadata = await sharp(spritesheet).metadata();
const fileInfo = await stat(spritesheet);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expectedFrameCounts = [6, 8, 8, 4, 5, 8, 6, 6, 6];

const errors = [];
if (metadata.width !== 1536) errors.push(`width must be 1536, got ${metadata.width}`);
if (metadata.height !== 1872) errors.push(`height must be 1872, got ${metadata.height}`);
if (!metadata.hasAlpha) errors.push("spritesheet must have an alpha channel");
if (metadata.format !== "webp") errors.push(`format must be webp, got ${metadata.format}`);
if (fileInfo.size > 20 * 1024 * 1024) errors.push("spritesheet must be no larger than 20 MiB");
if (!manifest.id) errors.push("manifest id is required");
if (manifest.spritesheetPath !== "spritesheet.webp") {
  errors.push("manifest spritesheetPath must be spritesheet.webp");
}

const { data, info } = await sharp(spritesheet)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let row = 0; row < 9; row += 1) {
  for (let column = 0; column < 8; column += 1) {
    let occupied = false;
    let touchesBoundary = false;
    for (let y = 0; y < 208; y += 1) {
      for (let x = 0; x < 192; x += 1) {
        const alphaIndex = ((row * 208 + y) * info.width + (column * 192 + x)) * 4 + 3;
        if (data[alphaIndex] > 0) {
          occupied = true;
          if (x === 0 || x === 191 || y === 0 || y === 207) touchesBoundary = true;
        }
      }
    }

    const expectedOccupied = column < expectedFrameCounts[row];
    if (expectedOccupied && !occupied) {
      errors.push(`row ${row}, column ${column} should contain a frame`);
    }
    if (!expectedOccupied && occupied) {
      errors.push(`row ${row}, column ${column} should be transparent`);
    }
    if (expectedOccupied && touchesBoundary) {
      errors.push(`row ${row}, column ${column} touches a cell boundary`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `OK: ${metadata.width}x${metadata.height} transparent ${metadata.format}, ${(fileInfo.size / 1024 / 1024).toFixed(2)} MiB`,
);
