import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
async function filesIn(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else files.push(filename);
  }
  return files;
}

const codeFiles = [...await filesIn(path.join(root, "src")), ...await filesIn(path.join(root, "scripts"))];
for (const filename of codeFiles) {
  if (!/\.(c?js|mjs)$/.test(filename) || filename.endsWith("engine-bundle.js")) continue;
  const result = spawnSync(process.execPath, ["--check", filename], { encoding: "utf8" });
  if (result.status !== 0) errors.push(result.stderr || result.error?.message || `Cannot check ${filename}`);
}

const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const appMetadata = JSON.parse(await readFile(path.join(root, "src", "app", "package.json"), "utf8"));
if (metadata.version !== appMetadata.version) errors.push("Root and application versions differ.");
if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) errors.push("Package version must use X.Y.Z.");
for (const filename of await filesIn(path.join(root, "examples"))) {
  if (filename.endsWith(".json")) JSON.parse(await readFile(filename, "utf8"));
}

const documents = [path.join(root, "README.md"), path.join(root, "CHANGELOG.md"),
  ...await filesIn(path.join(root, "docs"))].filter((filename) => filename.endsWith(".md"));
for (const filename of documents) {
  const text = (await readFile(filename, "utf8")).replace(/```[\s\S]*?```/g, "");
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  links.push(...[...text.matchAll(/\bsrc="([^"]+)"/g)].map((match) => match[1]));
  for (const link of links) {
    if (/^[a-z]+:|^#|^\/\//i.test(link)) continue;
    const relative = decodeURIComponent(link.split("#")[0]);
    if (!relative) continue;
    try { await access(path.resolve(path.dirname(filename), relative)); }
    catch { errors.push(`Broken documentation link: ${path.relative(root, filename)} -> ${link}`); }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("OK: source syntax, version consistency, example JSON and local documentation links.");
