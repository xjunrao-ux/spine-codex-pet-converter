# Spine → Codex 桌宠转换器 v1.1.0

当前推荐的 Windows 正式版，重点是“下载、解压、运行”，不要求用户安装 Node.js。

## 下载

- `SpineCodexConverter-Full-v1.1.0.zip`：完整便携版。
- `SHA256SUMS-v1.1.0.txt`：下载完整性校验值。

请不要把 GitHub 自动生成的 `Source code.zip` 当作普通用户软件包。

## 首次使用

1. 完整解压 ZIP。
2. 双击 `SpineCodexConverter.exe`。
3. 选择包含 `.skel`、`.atlas` 和贴图的目录。
4. 先检查动画映射，再开始转换。
5. 将 `pet.json` 和 `spritesheet.webp` 放入 `C:\Users\你的用户名\.codex\pets\桌宠ID\`。
6. 在 Codex 的 **Settings → Pets** 中点击 **Refresh** 并选择桌宠。

详细字段、命令行参数和故障排查见 [`USAGE.md`](USAGE.md)。

## 主要变化

- 完整 Electron 桌面版，不依赖本机 Node.js。
- 统一程序图标与便携 EXE 图标。
- 将 v1.0.0 轻量入口、实验工具和示例配置分类归档。
- 补充素材来源、版权边界、安装方法和版本路线图。

发布包不包含任何游戏模型。请只转换你有权使用的素材，且不要把受版权保护的原始模型或贴图重新打包分发。
