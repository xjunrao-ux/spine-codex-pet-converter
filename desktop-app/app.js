const elements = Object.fromEntries([
  "input", "output", "config", "base", "pet-id", "display-name", "scale", "scale-range",
  "inspect", "convert", "choose-input", "choose-output", "choose-config", "open-output",
  "progress", "percent", "progress-message", "preview", "preview-empty", "log", "clear-log",
].map((id) => [id, document.getElementById(id)]));

let busy = false;

function appendLog(message) {
  if (elements.log.textContent === "选择素材文件夹后，可先点击“检查动画”。") elements.log.textContent = "";
  elements.log.textContent += `${message}\n`;
  elements.log.scrollTop = elements.log.scrollHeight;
}

function setBusy(value) {
  busy = value;
  elements.inspect.disabled = value;
  elements.convert.disabled = value;
  elements["choose-input"].disabled = value;
  elements["choose-output"].disabled = value;
  elements["choose-config"].disabled = value;
}

function options() {
  return {
    input: elements.input.value.trim(),
    output: elements.output.value.trim(),
    config: elements.config.value.trim(),
    base: elements.base.value.trim(),
    id: elements["pet-id"].value.trim(),
    name: elements["display-name"].value.trim(),
    scalePercent: Number(elements.scale.value || 100),
  };
}

function validate() {
  if (!elements.input.value.trim()) throw new Error("请先选择素材文件夹。");
  if (!elements.output.value.trim()) throw new Error("请选择输出文件夹。");
}

async function run(kind) {
  if (busy) return;
  try {
    validate();
    setBusy(true);
    elements.log.textContent = "";
    elements.progress.value = 0;
    elements.percent.textContent = "0%";
    const result = kind === "inspect"
      ? await window.petTool.inspect(options())
      : await window.petTool.convert(options());

    if (kind === "inspect") {
      appendLog("\n可用动画：");
      for (const animation of result.inspection.animations) {
        appendLog(`  ${animation.name} · ${animation.duration.toFixed(3)} 秒`);
      }
      appendLog("\n检查完成。上方日志中的“状态 → 动画”就是最终映射。");
    } else {
      elements.preview.src = result.previewDataUrl;
      elements.preview.style.display = "block";
      elements["preview-empty"].style.display = "none";
      appendLog("\n转换完成，精灵表已经通过尺寸、边界和文件大小检查。");
    }
  } catch (error) {
    appendLog(`\n错误：${error.message || error}`);
    elements["progress-message"].textContent = "处理失败，请查看日志";
  } finally {
    setBusy(false);
  }
}

elements["choose-input"].addEventListener("click", async () => {
  const folder = await window.petTool.chooseInput();
  if (!folder) return;
  elements.input.value = folder;
  elements.output.value = `${folder}\\codex-pet-output`;
});

elements["choose-output"].addEventListener("click", async () => {
  const folder = await window.petTool.chooseOutput();
  if (folder) elements.output.value = folder;
});

elements["choose-config"].addEventListener("click", async () => {
  const file = await window.petTool.chooseConfig();
  if (file) elements.config.value = file;
});

elements["scale-range"].addEventListener("input", () => { elements.scale.value = elements["scale-range"].value; });
elements.scale.addEventListener("input", () => {
  const value = Math.max(25, Math.min(200, Number(elements.scale.value || 100)));
  elements["scale-range"].value = value;
});
elements.inspect.addEventListener("click", () => run("inspect"));
elements.convert.addEventListener("click", () => run("convert"));
elements["open-output"].addEventListener("click", () => {
  if (elements.output.value.trim()) window.petTool.openOutput(elements.output.value.trim());
});
elements["clear-log"].addEventListener("click", () => { elements.log.textContent = ""; });

window.petTool.onProgress((progress) => {
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  elements.progress.value = percent;
  elements.percent.textContent = `${percent}%`;
  elements["progress-message"].textContent = progress.message || progress.stage || "处理中";
});
window.petTool.onLog(appendLog);
