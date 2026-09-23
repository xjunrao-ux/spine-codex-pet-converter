import { createServer } from "node:http";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const COLUMNS = 8;

const STATE_SPECS = [
  { name: "idle", frames: 6, aliases: ["idle", "relax", "stand", "default"] },
  { name: "running-right", frames: 8, aliases: ["move", "run", "walk", "running"] },
  {
    name: "running-left",
    frames: 8,
    aliases: ["move", "run", "walk", "running"],
    flip: true,
  },
  {
    name: "waving",
    frames: 4,
    aliases: ["wave", "interact", "hello", "greet"],
    loop: false,
  },
  { name: "jumping", frames: 5, aliases: ["jump", "hop"], loop: false },
  {
    name: "failed",
    frames: 8,
    aliases: ["failed", "fail", "death", "die", "sleep", "fall", "down"],
    loop: false,
  },
  { name: "waiting", frames: 6, aliases: ["wait", "sit", "idle", "relax"] },
  { name: "running", frames: 6, aliases: ["run", "move", "walk", "running"] },
  { name: "review", frames: 6, aliases: ["review", "think", "sit", "inspect", "idle"] },
];

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".atlas", "text/plain; charset=utf-8"],
  [".skel", "application/octet-stream"],
]);

function printUsage() {
  console.log(`
Spine -> Codex pet converter

Usage:
  node scripts/convert-spine.mjs --input <asset-folder> [options]

Options:
  --output <folder>   Output folder (default: <input>/<base>-codex-pet)
  --config <json>     Mapping configuration (default: codex-pet.config.json in input)
  --base <name>       Skeleton basename when the input has multiple .skel files
  --id <slug>         Override pet id
  --name <text>       Override display name
  --inspect           Print animations and resolved mapping without rendering
  --help              Show this help
`);
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (["inspect", "help"].includes(key)) {
      parsed[key] = true;
    } else {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
      parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "spine-pet";
}

function normalizedName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findAnimation(animations, aliases) {
  const exact = aliases
    .map((alias) => animations.find((animation) => animation.name.toLowerCase() === alias))
    .find(Boolean);
  if (exact) return exact;

  return aliases
    .map((alias) => {
      const normalizedAlias = normalizedName(alias);
      return animations.find((animation) =>
        normalizedName(animation.name).includes(normalizedAlias),
      );
    })
    .find(Boolean);
}

function resolveRequestedAnimation(animations, requested) {
  if (!requested) return undefined;
  return (
    animations.find((animation) => animation.name === requested) ??
    animations.find((animation) => animation.name.toLowerCase() === requested.toLowerCase())
  );
}

function createResolvedStates(animations, config) {
  if (animations.length === 0) throw new Error("The skeleton contains no animations.");
  const fallback = animations.find((animation) => animation.duration > 0) ?? animations[0];
  const idle = findAnimation(animations, STATE_SPECS[0].aliases) ?? fallback;

  return STATE_SPECS.map((spec) => {
    const custom = config.states?.[spec.name] ?? {};
    const requested = resolveRequestedAnimation(animations, custom.animation);
    if (custom.animation && !requested) {
      throw new Error(
        `State ${spec.name} requests missing animation ${custom.animation}. Available: ${animations.map((item) => item.name).join(", ")}`,
      );
    }

    const automatic = findAnimation(animations, spec.aliases);
    const selected = requested ?? automatic ?? idle;
    const synthesizedJump = spec.name === "jumping" && !requested && !automatic;
    const range = custom.range ?? [0, 1];
    if (!Array.isArray(range) || range.length !== 2) {
      throw new Error(`State ${spec.name} range must be [start, end].`);
    }

    return {
      name: spec.name,
      frames: spec.frames,
      animation: selected.name,
      duration: selected.duration,
      loop: custom.loop ?? spec.loop ?? true,
      flip: custom.flip ?? spec.flip ?? false,
      range: [Number(range[0]), Number(range[1])],
      scale: Number(custom.scale ?? (synthesizedJump ? 0.9 : 1)),
      offsetX: Number(custom.offsetX ?? 0),
      offsetY: Number(custom.offsetY ?? 0),
      motion: custom.motion ??
        (synthesizedJump ? { type: "jump", height: 12 } : undefined),
      source: requested ? "config" : automatic ? "automatic" : "fallback",
    };
  });
}

async function fileExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function discoverSource(inputDir, baseOverride) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const skeletons = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".skel"))
    .map((entry) => entry.name);

  if (skeletons.length === 0) throw new Error(`No .skel file found in ${inputDir}`);

  let skelName;
  if (baseOverride) {
    skelName = skeletons.find(
      (name) => path.basename(name, path.extname(name)).toLowerCase() === baseOverride.toLowerCase(),
    );
    if (!skelName) throw new Error(`No .skel file matches --base ${baseOverride}`);
  } else if (skeletons.length === 1) {
    [skelName] = skeletons;
  } else {
    throw new Error(
      `Multiple .skel files found. Use --base with one of: ${skeletons.map((name) => path.basename(name, ".skel")).join(", ")}`,
    );
  }

  const base = path.basename(skelName, path.extname(skelName));
  const atlasName = `${base}.atlas`;
  if (!(await fileExists(path.join(inputDir, atlasName)))) {
    throw new Error(`Missing matching atlas file: ${atlasName}`);
  }

  const atlasText = await readFile(path.join(inputDir, atlasName), "utf8");
  const textureNames = atlasText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\.(png|webp|jpe?g)$/i.test(line));
  for (const textureName of textureNames) {
    if (!(await fileExists(path.join(inputDir, textureName)))) {
      throw new Error(`Atlas references missing texture: ${textureName}`);
    }
  }

  return { base, skelName, atlasName, textureNames };
}

function pathInside(root, relativeUrl) {
  const target = path.resolve(root, `.${relativeUrl}`);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal rejected");
  }
  return target;
}

async function startServer(inputDir) {
  const server = createServer(async (request, response) => {
    try {
      const urlPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
      let target;
      if (urlPath.startsWith("/input/")) {
        target = pathInside(inputDir, urlPath.slice("/input".length));
      } else {
        const projectPath = urlPath === "/" ? "/renderer.html" : urlPath;
        target = pathInside(projectDir, projectPath);
      }
      const fileStat = await stat(target);
      if (!fileStat.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "Content-Type": MIME_TYPES.get(path.extname(target).toLowerCase()) ??
          "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(await readFile(target));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error("Microsoft Edge or Google Chrome was not found.");
}

function frameOffset(state, progress) {
  let x = state.offsetX;
  let y = state.offsetY;
  if (state.motion?.type === "jump") {
    const height = Number(state.motion.height ?? 12);
    y += height - height * Math.sin(Math.PI * progress);
  }
  return { x, y };
}

async function validateSheet(spritesheetPath, manifestPath) {
  const errors = [];
  const metadata = await sharp(spritesheetPath).metadata();
  const fileInfo = await stat(spritesheetPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (metadata.width !== 1536) errors.push(`width must be 1536, got ${metadata.width}`);
  if (metadata.height !== 1872) errors.push(`height must be 1872, got ${metadata.height}`);
  if (!metadata.hasAlpha) errors.push("spritesheet must have an alpha channel");
  if (metadata.format !== "webp") errors.push(`format must be webp, got ${metadata.format}`);
  if (fileInfo.size > 20 * 1024 * 1024) errors.push("spritesheet exceeds 20 MiB");
  if (!manifest.id) errors.push("pet.json is missing id");
  if (manifest.spritesheetPath !== "spritesheet.webp") {
    errors.push("pet.json spritesheetPath must be spritesheet.webp");
  }

  const { data, info } = await sharp(spritesheetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let row = 0; row < STATE_SPECS.length; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      let occupied = false;
      let touchesBoundary = false;
      for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
          const alphaIndex =
            ((row * CELL_HEIGHT + y) * info.width + (column * CELL_WIDTH + x)) * 4 + 3;
          if (data[alphaIndex] > 0) {
            occupied = true;
            if (x === 0 || x === CELL_WIDTH - 1 || y === 0 || y === CELL_HEIGHT - 1) {
              touchesBoundary = true;
            }
          }
        }
      }
      const expectedOccupied = column < STATE_SPECS[row].frames;
      if (expectedOccupied && !occupied) errors.push(`row ${row}, column ${column} is empty`);
      if (!expectedOccupied && occupied) {
        errors.push(`row ${row}, column ${column} must be transparent`);
      }
      if (expectedOccupied && touchesBoundary) {
        errors.push(`row ${row}, column ${column} touches a cell boundary`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    width: metadata.width,
    height: metadata.height,
    bytes: fileInfo.size,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.input) {
    printUsage();
    throw new Error("--input is required.");
  }

  const inputDir = path.resolve(args.input);
  const source = await discoverSource(inputDir, args.base);
  const conventionalConfig = path.join(inputDir, "codex-pet.config.json");
  const configPath = args.config
    ? path.resolve(args.config)
    : (await fileExists(conventionalConfig))
      ? conventionalConfig
      : undefined;
  const config = configPath ? JSON.parse(await readFile(configPath, "utf8")) : {};
  const petId = slugify(args.id ?? config.id ?? source.base);
  const displayName = args.name ?? config.displayName ?? source.base;
  const outputDir = path.resolve(args.output ?? path.join(inputDir, `${petId}-codex-pet`));
  const padding = Number(config.padding ?? 5);
  const workDir = await mkdtemp(path.join(os.tmpdir(), "spine-codex-"));

  await mkdir(path.join(projectDir, "build"), { recursive: true });
  await build({
    entryPoints: [path.join(projectDir, "scripts", "browser-entry.js")],
    outfile: path.join(projectDir, "build", "browser.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    sourcemap: false,
  });

  const server = await startServer(inputDir);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const browser = await puppeteer.launch({
    executablePath: await findBrowser(),
    headless: true,
    userDataDir: path.join(workDir, "browser-profile"),
    args: ["--disable-gpu-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CELL_WIDTH, height: CELL_HEIGHT, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => console.error(`[browser] ${error.stack ?? error.message}`));
    const asset = encodeURIComponent(`/input/${source.skelName}`);
    await page.goto(
      `http://127.0.0.1:${port}/renderer.html?asset=${asset}&padding=${padding}`,
      { waitUntil: "networkidle0" },
    );
    await page.evaluate(() => window.petReady);
    const info = await page.evaluate(() => window.petInfo);
    const states = createResolvedStates(info.animations, config);

    const inspection = {
      source,
      animations: info.animations,
      animationBounds: info.animationBounds,
      padding,
      states,
    };
    if (args.inspect) {
      console.log(JSON.stringify(inspection, null, 2));
      return;
    }

    await mkdir(outputDir, { recursive: true });
    const frameDir = path.join(workDir, "frames");
    await mkdir(frameDir, { recursive: true });
    const composites = [];

    for (let row = 0; row < states.length; row += 1) {
      const state = states[row];
      const stateDir = path.join(frameDir, `${row}-${state.name}`);
      await mkdir(stateDir, { recursive: true });
      for (let column = 0; column < state.frames; column += 1) {
        const progress = state.loop
          ? column / state.frames
          : state.frames === 1
            ? 0
            : column / (state.frames - 1);
        const normalizedTime = state.range[0] + (state.range[1] - state.range[0]) * progress;
        const time = state.duration * normalizedTime;
        const offset = frameOffset(state, progress);
        const dataUrl = await page.evaluate(
          (options) => window.renderPetFrame(options),
          {
            animation: state.animation,
            time,
            flip: state.flip,
            scale: state.scale,
            offsetX: offset.x,
            offsetY: offset.y,
          },
        );
        const png = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
        await writeFile(path.join(stateDir, `${String(column).padStart(2, "0")}.png`), png);
        composites.push({
          input: png,
          left: column * CELL_WIDTH,
          top: row * CELL_HEIGHT,
        });
      }
    }

    const sheet = sharp({
      create: {
        width: CELL_WIDTH * COLUMNS,
        height: CELL_HEIGHT * STATE_SPECS.length,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite(composites);
    const spritesheetPath = path.join(outputDir, "spritesheet.webp");
    const manifestPath = path.join(outputDir, "pet.json");
    await sheet
      .clone()
      .webp({ lossless: true, quality: 100, effort: 6 })
      .toFile(spritesheetPath);
    await sheet
      .clone()
      .flatten({ background: "#e7ebf2" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDir, "spritesheet-preview.png"));

    const manifest = {
      id: petId,
      displayName,
      description:
        config.description ?? `Codex pet converted from Spine model ${source.base}.`,
      spritesheetPath: "spritesheet.webp",
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const validation = await validateSheet(spritesheetPath, manifestPath);
    const report = {
      convertedAt: new Date().toISOString(),
      inputDir,
      outputDir,
      configPath: configPath ?? null,
      ...inspection,
      validation,
    };
    await writeFile(
      path.join(outputDir, "conversion-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(outputDir, "resolved-config.json"),
      `${JSON.stringify({
        id: petId,
        displayName,
        description: manifest.description,
        padding,
        states: Object.fromEntries(
          states.map((state) => [
            state.name,
            {
              animation: state.animation,
              loop: state.loop,
              flip: state.flip,
              range: state.range,
              scale: state.scale,
              offsetX: state.offsetX,
              offsetY: state.offsetY,
              ...(state.motion ? { motion: state.motion } : {}),
            },
          ]),
        ),
      }, null, 2)}\n`,
      "utf8",
    );

    if (!validation.ok) {
      throw new Error(`Validation failed:\n${validation.errors.join("\n")}`);
    }

    console.log(`Converted ${source.skelName}`);
    console.log(`Output: ${outputDir}`);
    console.log(
      `Validated: ${validation.width}x${validation.height}, ${(validation.bytes / 1024 / 1024).toFixed(2)} MiB`,
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
