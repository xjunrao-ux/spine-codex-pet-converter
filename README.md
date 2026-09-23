# Spine → Codex 桌宠转换器

把 Spine 3.8 的 `.skel + .atlas + 贴图` 转换成 Codex 自定义桌宠使用的精灵表。当前正式版本为 **v1.0.0**，支持 Windows 10/11。

## 直接下载（推荐）

不需要安装 Node.js，也不需要下载源码：

1. 打开仓库的 [Releases 最新版本](../../releases/latest)。
2. 下载 `SpineCodexConverter-Full.zip`。
3. 解压后双击 `SpineCodexConverter.exe`。
4. 选择素材文件夹和输出目录，点击“检查动画”，再点击“开始转换”。

请勿只下载 GitHub 自动生成的 `Source code.zip`；那是开发源码，不是开箱即用的软件包。

## 输入与输出

输入目录至少包含同名文件：

```text
character.skel
character.atlas
character.png
```

输出目录为：

```text
codex-pet-output/
├─ pet.json
├─ spritesheet.webp
├─ spritesheet-preview.png
├─ conversion-report.json
└─ resolved-config.json
```

安装桌宠时只需要 `pet.json` 和 `spritesheet.webp`。精灵表规格为 1536 × 1872、8 列 × 9 行，每格 192 × 208，最大 20 MiB。

## 功能

- 自动识别待机、移动、招手、跳跃、失败、等待和审视等动作。
- 缺少跳跃动画时可生成合成跳跃。
- 支持 25%～200% 的人物缩放与逐帧越界检查。
- 支持配置文件覆盖自动动画映射。
- 输出预览图、最终配置和完整转换报告。
- 完整版自带 Electron 渲染内核，不依赖系统浏览器或开发环境。

详细操作、配置字段和常见问题见 [使用说明](docs/USAGE.md)。

## 从源码运行

```powershell
corepack pnpm install --frozen-lockfile
node .\desktop\build-desktop.mjs
```

转换命令示例：

```powershell
node scripts/convert-spine.mjs --input "D:\path\to\model-folder"
node scripts/convert-spine.mjs --input "D:\path\to\model-folder" --inspect
```

生成 Windows 完整版：

```powershell
powershell -ExecutionPolicy Bypass -File .\package-desktop.ps1
```

发布维护流程见 [发布说明](docs/RELEASING.md)。

## 版本状态

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| v1.0.0 | 正式版 | 首个稳定图形界面与命令行版本 |
| v1.x | 规划中 | 兼容性、诊断信息和体验改进 |

完整记录见 [CHANGELOG](CHANGELOG.md) 和 [ROADMAP](ROADMAP.md)。

## 素材与许可

仓库不包含测试角色模型和转换结果。你只能转换、使用和分发自己拥有相应权利的素材。

当前代码未授予开源再许可，`package.json` 标记为 `UNLICENSED`。如果以后希望其他人修改或分发源码，应先明确选择 MIT、Apache-2.0 等许可证。
