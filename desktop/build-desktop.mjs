import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(root, "desktop", "engine-entry.js")],
  outfile: path.join(root, "desktop-app", "engine-bundle.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  sourcemap: false,
  minify: true,
});

console.log("Desktop renderer bundle created.");
