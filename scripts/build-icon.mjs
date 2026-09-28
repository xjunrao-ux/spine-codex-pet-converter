import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(projectRoot, "desktop-app", "assets", "app-icon.png");
const outputPath = path.join(projectRoot, "desktop-app", "assets", "app-icon.ico");
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

const images = await Promise.all(sizes.map((size) => sharp(inputPath)
  .resize(size, size, { fit: "contain", kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9 })
  .toBuffer()));

const headerSize = 6;
const entrySize = 16;
let imageOffset = headerSize + entrySize * images.length;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

const entries = images.map((image, index) => {
  const size = sizes[index];
  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(imageOffset, 12);
  imageOffset += image.length;
  return entry;
});

await fs.writeFile(outputPath, Buffer.concat([header, ...entries, ...images]));
console.log(`Created Windows icon: ${outputPath} (${sizes.join(", ")} px)`);
