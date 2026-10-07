# 转换器结构与设计记录

## 当前范围

维护 Windows 上的 Electron 完整桌面转换器：读取 Spine 3.8 模型，检查动画，映射九个状态，生成精灵表、清单、预览与报告。不维护桌宠运行程序、对话浮层或另一套浏览器转换器。

```text
src/app/index.html + app.js
        ↓ preload.cjs 的固定 IPC
src/app/main.cjs
        ↓ 本地素材服务 + 隐藏渲染窗口
src/engine/engine-entry.js
        ↓ spritesheet / preview / validation
main.cjs 写入 pet.json、WebP、PNG 和报告
```

## 模块

| 位置 | 责任 |
| --- | --- |
| `src/app/` | Electron 主进程、界面、IPC、渲染页面和图标 |
| `src/engine/` | PixiJS / Spine 加载、动画边界测量与精灵表绘制 |
| `scripts/build-desktop.mjs` | 将渲染引擎编译到 `src/app/engine-bundle.js` |
| `scripts/check.mjs` | 源码、版本与本地文档链接检查 |
| `scripts/validate.mjs` | 校验实际转换结果，不依赖默认游戏模型 |
| `scripts/package-desktop.ps1` | 使用本项目 Electron 运行库打包并计算 SHA-256 |
| `_local/` | 不提交的模型、输出、缓存、历史备份与发布包 |

## 决策：只维护完整桌面版（2026-10-07）

背景：旧命令行入口与 Electron 主进程各自维护动画映射、渲染和输出代码，容易出现两套行为不一致；根目录还保留历史启动器、实验和多份发布目录。

选择：完整桌面版作为唯一当前产品入口；旧浏览器转换器、WinForms、对话实验移到本地归档，公开历史通过 Git 标签保存。构建工具集中到 `scripts/`，版本不在多个源码文件夹间独立迭代。

代价：当前源码不再提供旧 CLI 命令，需要它的用户使用历史版本。自动验证仍可调用 Electron 的 `--self-test` 和 `--smoke-test` 参数，无需维护另一套转换核心。

## 决策：提交与发布分离（2026-10-07）

`main` 接收已验证的维护提交；`vX.Y.Z` 标签和 Release 才表示正式发布。源码整理先记录“未发布”，不改写 v1.0.0 / v1.1.0。发行包按版本保存，打包脚本发现已有产物会停止，避免覆盖历史版本。
