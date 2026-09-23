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
    const time = animation.duration * (index / samples);
    setPose(animation.name, time);
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

async function initialize() {
  const loaded = await Assets.load(assetUrl);
  const skeletonData = loaded.spineData ?? loaded;
  spine = new Spine(skeletonData);
  app.stage.addChild(spine);

  const animations = skeletonData.animations.map((animation) => ({
    name: animation.name,
    duration: animation.duration,
  }));

  animationBounds = Object.fromEntries(
    animations.map((animation) => [animation.name, measureAnimation(animation)]),
  );

  window.petInfo = {
    animations,
    animationBounds,
    padding,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
  };

  window.renderPetFrame = async ({
    animation,
    time,
    flip = false,
    scale = 1,
    offsetX = 0,
    offsetY = 0,
  }) => {
    setPose(animation, time);
    placeCharacter(animation, flip, scale, offsetX, offsetY);
    app.renderer.render(app.stage);
    return app.view.toDataURL("image/png");
  };
}

window.petReady = initialize();
