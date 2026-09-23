import { Application, Assets } from "pixi.js";
import { Spine } from "pixi-spine";

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const parameters = new URLSearchParams(window.location.search);
const assetUrl = parameters.get("asset") ?? "/input/model.skel";
const padding = Math.max(0, Number(parameters.get("padding") ?? 6));

const app = new Application({
  width: CELL_WIDTH,
  height: CELL_HEIGHT,
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: false,
  preserveDrawingBuffer: true,
  resolution: 1,
});

document.body.appendChild(app.view);
app.ticker.stop();

let spine;
let animationBounds = {};

function report(progress) {
  window.desktopEngine?.reportProgress(progress);
}

function setPose(animationName, time) {
  spine.state.clearTracks();
  spine.skeleton.setToSetupPose();
  const entry = spine.state.setAnimation(0, animationName, false);
  entry.trackTime = Math.max(0, time);
  spine.state.apply(spine.skeleton);
  spine.skeleton.updateWorldTransform();
}

function measureAnimation(animation) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  spine.scale.set(1, 1);
  spine.position.set(0, 0);
  const samples = animation.duration > 0
    ? Math.max(12, Math.ceil(animation.duration * 24))
    : 1;

  for (let index = 0; index <= samples; index += 1) {
    setPose(animation.name, animation.duration * (index / samples));
    const bounds = spine.getLocalBounds();
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
  bounds.fittedScale = Math.min(
    (CELL_WIDTH - padding * 2) / bounds.width,
    (CELL_HEIGHT - padding * 2) / bounds.height,
  );
  return bounds;
}

function placeCharacter(animationName, flip, scaleMultiplier, offsetX, offsetY) {
  const bounds = animationBounds[animationName];
  if (!bounds) throw new Error(`No measured bounds for ${animationName}`);

  const sign = flip ? -1 : 1;
  const scale = bounds.fittedScale * scaleMultiplier;
  spine.scale.set(sign * scale, scale);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  spine.position.set(
    CELL_WIDTH / 2 - centerX * sign * scale + offsetX,
    CELL_HEIGHT / 2 - centerY * scale + offsetY,
  );
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

function inspectCell(context, left, top) {
  const pixels = context.getImageData(left, top, CELL_WIDTH, CELL_HEIGHT).data;
  let occupied = false;
  let touchesBoundary = false;
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const alpha = pixels[(y * CELL_WIDTH + x) * 4 + 3];
      if (alpha === 0) continue;
      occupied = true;
      if (x === 0 || x === CELL_WIDTH - 1 || y === 0 || y === CELL_HEIGHT - 1) {
        touchesBoundary = true;
      }
    }
  }
  return { occupied, touchesBoundary };
}

async function initialize() {
  report({ percent: 2, stage: "load", message: "正在加载骨骼与纹理…" });
  const loaded = await Assets.load(assetUrl);
  if (!loaded) {
    throw new Error(`无法加载骨骼素材：${assetUrl}。请检查 .skel、.atlas 和纹理是否同名且完整。`);
  }
  const skeletonData = loaded.spineData ?? loaded;
  if (!skeletonData?.animations) {
    throw new Error("骨骼素材已读取，但没有得到 Spine 动画数据。请检查 Spine 导出版本是否为 3.8。 ");
  }
  spine = new Spine(skeletonData);
  app.stage.addChild(spine);

  const animations = skeletonData.animations.map((animation) => ({
    name: animation.name,
    duration: animation.duration,
  }));

  animationBounds = {};
  for (let index = 0; index < animations.length; index += 1) {
    const animation = animations[index];
    report({
      percent: 5 + Math.round(((index + 1) / animations.length) * 15),
      stage: "measure",
      current: index + 1,
      total: animations.length,
      animation: animation.name,
      message: `正在测量动画：${animation.name}（${index + 1}/${animations.length}）`,
    });
    animationBounds[animation.name] = measureAnimation(animation);
  }

  window.petInfo = {
    animations,
    animationBounds,
    padding,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
  };

  window.buildPetSheet = async ({ states }) => {
    const sheet = document.createElement("canvas");
    sheet.width = CELL_WIDTH * 8;
    sheet.height = CELL_HEIGHT * 9;
    const context = sheet.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, sheet.width, sheet.height);

    const totalFrames = states.reduce((sum, state) => sum + state.frames, 0);
    let completedFrames = 0;
    const errors = [];
    const warnings = [];

    for (let row = 0; row < states.length; row += 1) {
      const state = states[row];
      for (let column = 0; column < state.frames; column += 1) {
        const progress = state.loop
          ? column / state.frames
          : state.frames === 1
            ? 0
            : column / (state.frames - 1);
        const normalizedTime = state.range[0] + (state.range[1] - state.range[0]) * progress;
        const offset = frameOffset(state, progress);

        setPose(state.animation, state.duration * normalizedTime);
        placeCharacter(state.animation, state.flip, state.scale, offset.x, offset.y);
        app.renderer.render(app.stage);

        const left = column * CELL_WIDTH;
        const top = row * CELL_HEIGHT;
        context.drawImage(app.view, left, top);
        const cell = inspectCell(context, left, top);
        if (!cell.occupied) errors.push(`${state.name} 第 ${column + 1} 帧为空`);
        if (cell.touchesBoundary) warnings.push(`${state.name} 第 ${column + 1} 帧碰到单元格边界，可能发生裁切`);

        completedFrames += 1;
        report({
          percent: 20 + Math.round((completedFrames / totalFrames) * 74),
          stage: "render",
          current: completedFrames,
          total: totalFrames,
          state: state.name,
          frame: column + 1,
          stateFrames: state.frames,
          message: `正在渲染 ${state.name}：${column + 1}/${state.frames}（总计 ${completedFrames}/${totalFrames}）`,
        });
        // Hidden Electron windows do not always receive animation frames. Yield to
        // the event loop with a timer so progress IPC stays responsive off-screen.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    report({ percent: 95, stage: "encode", message: "正在编码 WebP 精灵表…" });
    const webpDataUrl = sheet.toDataURL("image/webp", 1);

    const preview = document.createElement("canvas");
    preview.width = sheet.width;
    preview.height = sheet.height;
    const previewContext = preview.getContext("2d");
    previewContext.fillStyle = "#e7ebf2";
    previewContext.fillRect(0, 0, preview.width, preview.height);
    previewContext.drawImage(sheet, 0, 0);
    const previewDataUrl = preview.toDataURL("image/png");

    return {
      webpDataUrl,
      previewDataUrl,
      errors,
      warnings,
      width: sheet.width,
      height: sheet.height,
      totalFrames,
    };
  };

  report({ percent: 20, stage: "ready", message: "骨骼加载完成" });
  return window.petInfo;
}

window.petReady = initialize();
