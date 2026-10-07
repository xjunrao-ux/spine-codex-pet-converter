const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const APP_ROOT = __dirname;
const APP_ICON = path.join(APP_ROOT, "assets", "app-icon.png");
const STATE_SPECS = [
  { name: "idle", frames: 6, aliases: ["idle", "relax", "stand", "default"] },
  { name: "running-right", frames: 8, aliases: ["move", "run", "walk", "running"] },
  { name: "running-left", frames: 8, aliases: ["move", "run", "walk", "running"], flip: true },
  { name: "waving", frames: 4, aliases: ["wave", "interact", "hello", "greet"], loop: false },
  { name: "jumping", frames: 5, aliases: ["jump", "hop"], loop: false },
  { name: "failed", frames: 8, aliases: ["failed", "fail", "death", "die", "sleep", "fall", "down"], loop: false },
  { name: "waiting", frames: 6, aliases: ["wait", "sit", "idle", "relax"] },
  { name: "running", frames: 6, aliases: ["run", "move", "walk", "running"] },
  { name: "review", frames: 6, aliases: ["review", "think", "sit", "inspect", "idle"] },
];

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".atlas", "text/plain; charset=utf-8"],
  [".skel", "application/octet-stream"],
]);

let mainWindow;
let server;
let serverPort;
let activeInputDir;
let activeJob = false;
let activeEngineWindow;

function safePath(root, requestPath) {
  const target = path.resolve(root, `.${requestPath}`);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path traversal rejected");
  return target;
}

async function startServer() {
  server = http.createServer(async (request, response) => {
    try {
      const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
      let target;
      if (urlPath.startsWith("/input/")) {
        if (!activeInputDir) throw new Error("No active input");
        target = safePath(activeInputDir, urlPath.slice("/input".length));
      } else {
        target = safePath(APP_ROOT, urlPath === "/" ? "/index.html" : urlPath);
      }
      const info = await fsp.stat(target);
      if (!info.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "Content-Type": MIME_TYPES.get(path.extname(target).toLowerCase()) || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      if (urlPath.startsWith("/input/") && path.extname(target).toLowerCase() === ".atlas") {
        const atlasText = await fsp.readFile(target, "utf8");
        const encodedAtlas = atlasText.split(/(\r?\n)/).map((line) => {
          const trimmed = line.trim();
          if (!/\.(png|webp|jpe?g)$/i.test(trimmed)) return line;
          const leading = line.slice(0, line.indexOf(trimmed));
          const encoded = trimmed.split(/[\\/]/).map((part) => encodeURIComponent(part)).join("/");
          return `${leading}${encoded}`;
        }).join("");
        response.end(encodedAtlas);
      } else {
        response.end(await fsp.readFile(target));
      }
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  serverPort = server.address().port;
}

function createMainWindow(show = true) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    show,
    backgroundColor: "#f4f6fa",
    title: "Spine → Codex 桌宠转换器",
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(APP_ROOT, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/index.html`);
}

function emitProgress(progress) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("job-progress", progress);
}

function emitLog(message) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("job-log", message);
}

function slugify(value) {
  const slug = String(value || "")
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
  for (const alias of aliases) {
    const exact = animations.find((animation) => animation.name.toLowerCase() === alias);
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizedName(alias);
    const partial = animations.find((animation) => normalizedName(animation.name).includes(normalizedAlias));
    if (partial) return partial;
  }
  return undefined;
}

function resolveRequestedAnimation(animations, requested) {
  if (!requested) return undefined;
  return animations.find((animation) => animation.name === requested)
    || animations.find((animation) => animation.name.toLowerCase() === requested.toLowerCase());
}

function createResolvedStates(animations, config, globalScale) {
  if (animations.length === 0) throw new Error("骨骼文件中没有动画。");
  const fallback = animations.find((animation) => animation.duration > 0) || animations[0];
  const idle = findAnimation(animations, STATE_SPECS[0].aliases) || fallback;

  return STATE_SPECS.map((spec) => {
    const custom = config.states?.[spec.name] || {};
    const requested = resolveRequestedAnimation(animations, custom.animation);
    if (custom.animation && !requested) {
      throw new Error(`状态 ${spec.name} 指定了不存在的动画 ${custom.animation}。`);
    }
    const automatic = findAnimation(animations, spec.aliases);
    const selected = requested || automatic || idle;
    const synthesizedJump = spec.name === "jumping" && !requested && !automatic;
    const range = custom.range || [0, 1];
    if (!Array.isArray(range) || range.length !== 2) throw new Error(`${spec.name} 的 range 必须是 [start, end]。`);
    const stateScale = Number(custom.scale ?? (synthesizedJump ? 0.9 : 1));
    return {
      name: spec.name,
      frames: spec.frames,
      animation: selected.name,
      duration: selected.duration,
      loop: custom.loop ?? spec.loop ?? true,
      flip: custom.flip ?? spec.flip ?? false,
      range: [Number(range[0]), Number(range[1])],
      scale: stateScale * globalScale,
      stateScale,
      offsetX: Number(custom.offsetX ?? 0),
      offsetY: Number(custom.offsetY ?? 0),
      motion: custom.motion || (synthesizedJump ? { type: "jump", height: 12 } : undefined),
      source: requested ? "配置指定" : automatic ? "自动匹配" : "回退动画",
    };
  });
}

async function discoverSource(inputDir, baseOverride) {
  const entries = await fsp.readdir(inputDir, { withFileTypes: true });
  const skeletons = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".skel")).map((entry) => entry.name);
  if (skeletons.length === 0) throw new Error(`素材文件夹中没有 .skel 文件：${inputDir}`);

  let skelName;
  if (baseOverride) {
    skelName = skeletons.find((name) => path.basename(name, path.extname(name)).toLowerCase() === baseOverride.toLowerCase());
    if (!skelName) throw new Error(`没有找到骨骼基名：${baseOverride}`);
  } else if (skeletons.length === 1) {
    [skelName] = skeletons;
  } else {
    throw new Error(`发现多个 .skel 文件，请填写骨骼基名：${skeletons.map((name) => path.basename(name, ".skel")).join("、")}`);
  }

  const base = path.basename(skelName, path.extname(skelName));
  const atlasName = `${base}.atlas`;
  if (!fs.existsSync(path.join(inputDir, atlasName))) throw new Error(`缺少同名图集文件：${atlasName}`);
  const atlasText = await fsp.readFile(path.join(inputDir, atlasName), "utf8");
  const textureNames = atlasText.split(/\r?\n/).map((line) => line.trim()).filter((line) => /\.(png|webp|jpe?g)$/i.test(line));
  for (const textureName of textureNames) {
    if (!fs.existsSync(path.join(inputDir, textureName))) throw new Error(`图集引用的纹理不存在：${textureName}`);
  }
  return { base, skelName, atlasName, textureNames };
}

function decodeDataUrl(dataUrl) {
  return Buffer.from(dataUrl.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
}

async function loadOptions(payload) {
  const inputDir = path.resolve(payload.input || "");
  const source = await discoverSource(inputDir, String(payload.base || "").trim());
  const conventionalConfig = path.join(inputDir, "codex-pet.config.json");
  const configPath = payload.config
    ? path.resolve(payload.config)
    : fs.existsSync(conventionalConfig)
      ? conventionalConfig
      : undefined;
  const config = configPath ? JSON.parse(await fsp.readFile(configPath, "utf8")) : {};
  const scalePercent = Math.max(25, Math.min(200, Number(payload.scalePercent || 100)));
  const globalScale = scalePercent / 100;
  const petId = slugify(payload.id || config.id || source.base);
  const displayName = String(payload.name || config.displayName || source.base);
  const outputDir = path.resolve(payload.output || path.join(inputDir, `${petId}-codex-pet`));
  return {
    inputDir,
    outputDir,
    source,
    configPath,
    config,
    petId,
    displayName,
    scalePercent,
    globalScale,
    padding: Number(config.padding ?? 5),
  };
}

async function runJob(payload, inspectOnly) {
  if (activeJob) throw new Error("已有转换任务正在运行。");
  activeJob = true;
  emitProgress({ percent: 0, stage: "start", message: "正在检查输入文件…" });
  emitLog(inspectOnly ? "开始检查骨骼与动画映射" : "开始转换骨骼动画");

  let engineWindow;
  const progressHandler = (event, progress) => {
    if (engineWindow && event.sender.id === engineWindow.webContents.id) emitProgress(progress);
  };
  ipcMain.on("engine-progress", progressHandler);

  try {
    const options = await loadOptions(payload);
    activeInputDir = options.inputDir;
    emitLog(`骨骼：${options.source.skelName}`);
    emitLog(`全局大小：${options.scalePercent}%`);
    emitLog(options.configPath ? `映射配置：${options.configPath}` : "映射配置：自动识别");

    engineWindow = new BrowserWindow({
      width: 192,
      height: 208,
      show: false,
      transparent: true,
      webPreferences: {
        preload: path.join(APP_ROOT, "engine-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    activeEngineWindow = engineWindow;
    const encodedSkeletonName = options.source.skelName
      .split(/[\\/]/)
      .map((part) => encodeURIComponent(part))
      .join("/");
    const asset = encodeURIComponent(`/input/${encodedSkeletonName}`);
    await engineWindow.loadURL(`http://127.0.0.1:${serverPort}/engine.html?asset=${asset}&padding=${options.padding}`);
    const info = await engineWindow.webContents.executeJavaScript("window.petReady.then(() => window.petInfo)");
    const states = createResolvedStates(info.animations, options.config, options.globalScale);

    for (const state of states) emitLog(`${state.name} → ${state.animation}（${state.source}，${state.frames} 帧）`);
    const inspection = { source: options.source, animations: info.animations, animationBounds: info.animationBounds, padding: options.padding, states };

    if (inspectOnly) {
      emitProgress({ percent: 100, stage: "done", message: "动画检查完成" });
      return { inspection };
    }

    await fsp.mkdir(options.outputDir, { recursive: true });
    const result = await engineWindow.webContents.executeJavaScript(`window.buildPetSheet(${JSON.stringify({ states })})`);
    if (result.errors.length > 0) throw new Error(`画面校验失败：\n${result.errors.join("\n")}`);
    if (result.warnings.length > 0) {
      emitLog(`警告：共有 ${result.warnings.length} 帧触及单元格边界。人物可能被裁切；如需完整画面，请降低大小比例。`);
      for (const warning of result.warnings.slice(0, 8)) emitLog(`  ${warning}`);
      if (result.warnings.length > 8) emitLog(`  ……其余 ${result.warnings.length - 8} 条已写入转换报告`);
    }

    emitProgress({ percent: 97, stage: "write", message: "正在写入输出文件…" });
    const webp = decodeDataUrl(result.webpDataUrl);
    const preview = decodeDataUrl(result.previewDataUrl);
    if (result.width !== 1536 || result.height !== 1872) throw new Error(`精灵表尺寸错误：${result.width}×${result.height}`);
    if (webp.length > 20 * 1024 * 1024) throw new Error("精灵表超过 20 MiB。");
    if (webp.subarray(0, 4).toString("ascii") !== "RIFF" || webp.subarray(8, 12).toString("ascii") !== "WEBP") {
      throw new Error("浏览器没有生成有效的 WebP 文件。");
    }

    const spritesheetPath = path.join(options.outputDir, "spritesheet.webp");
    const previewPath = path.join(options.outputDir, "spritesheet-preview.png");
    const manifestPath = path.join(options.outputDir, "pet.json");
    await Promise.all([
      fsp.writeFile(spritesheetPath, webp),
      fsp.writeFile(previewPath, preview),
      fsp.writeFile(manifestPath, `${JSON.stringify({
        id: options.petId,
        displayName: options.displayName,
        description: options.config.description || `Codex pet converted from Spine model ${options.source.base}.`,
        spritesheetPath: "spritesheet.webp",
      }, null, 2)}\n`, "utf8"),
    ]);

    const resolvedConfig = {
      id: options.petId,
      displayName: options.displayName,
      globalScalePercent: options.scalePercent,
      padding: options.padding,
      states: Object.fromEntries(states.map((state) => [state.name, {
        animation: state.animation,
        loop: state.loop,
        flip: state.flip,
        range: state.range,
        scale: state.stateScale,
        effectiveScale: state.scale,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        ...(state.motion ? { motion: state.motion } : {}),
      }])),
    };
    const report = {
      convertedAt: new Date().toISOString(),
      renderer: "bundled-electron",
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      configPath: options.configPath || null,
      ...inspection,
      validation: {
        ok: true,
        width: 1536,
        height: 1872,
        bytes: webp.length,
        totalFrames: result.totalFrames,
        warnings: result.warnings,
      },
    };
    await Promise.all([
      fsp.writeFile(path.join(options.outputDir, "resolved-config.json"), `${JSON.stringify(resolvedConfig, null, 2)}\n`, "utf8"),
      fsp.writeFile(path.join(options.outputDir, "conversion-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    ]);

    emitLog(`完成：${spritesheetPath}`);
    emitLog(`尺寸：1536×1872，体积：${(webp.length / 1024 / 1024).toFixed(2)} MiB`);
    emitProgress({ percent: 100, stage: "done", message: "转换完成" });
    return { outputDir: options.outputDir, previewDataUrl: result.previewDataUrl, report };
  } finally {
    ipcMain.removeListener("engine-progress", progressHandler);
    activeInputDir = undefined;
    activeJob = false;
    activeEngineWindow = undefined;
    if (engineWindow && !engineWindow.isDestroyed()) engineWindow.destroy();
  }
}

function registerIpc() {
  ipcMain.handle("choose-input", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"], title: "选择 Spine 素材文件夹" });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("choose-output", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"], title: "选择输出文件夹" });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("choose-config", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], title: "选择动画映射 JSON", filters: [{ name: "JSON", extensions: ["json"] }] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("inspect-model", (_event, payload) => runJob(payload, true));
  ipcMain.handle("convert-model", (_event, payload) => runJob(payload, false));
  ipcMain.handle("open-output", async (_event, folder) => shell.openPath(path.resolve(folder)));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

app.setAppUserModelId("com.xjunrao.spine-codex-pet-converter");

app.whenReady().then(async () => {
  await startServer();
  registerIpc();

  if (process.argv.includes("--self-test")) {
    try {
      await runJob({
        input: argumentValue("--input"),
        output: argumentValue("--output"),
        config: argumentValue("--config"),
        scalePercent: Number(argumentValue("--scale") || 100),
      }, process.argv.includes("--inspect-only"));
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
    return;
  }

  const smokeTest = process.argv.includes("--smoke-test");
  createMainWindow(!smokeTest);
  if (smokeTest) setTimeout(() => app.exit(0), 1200);
});

app.on("window-all-closed", () => {
  if (activeEngineWindow && !activeEngineWindow.isDestroyed()) activeEngineWindow.destroy();
  if (server) server.close();
  app.quit();
});
