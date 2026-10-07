# 历史归档与恢复

当前仓库只展示正在维护的 Electron 完整桌面版。旧版本无需在当前源码中再复制一套：Git 标签保留完整历史；本机额外文件归入 `_local/`，不会推送 GitHub。

## 公开历史

- [v1.0.0 源码](https://github.com/xjunrao-ux/spine-codex-pet-converter/tree/v1.0.0)：早期轻量启动器与浏览器转换器。
- [v1.1.0 源码](https://github.com/xjunrao-ux/spine-codex-pet-converter/tree/v1.1.0)：清理前完整源码，包含旧 CLI、WinForms 和对话实验。
- [Releases](https://github.com/xjunrao-ux/spine-codex-pet-converter/releases)：历史安装包与版本说明。

查看旧文件而不改动当前工作区：

```powershell
git show v1.1.0:scripts/convert-spine.mjs
git ls-tree -r --name-only v1.1.0
```

需要独立的完整历史源码时：

```powershell
git archive --format=zip --output=_local/archive/v1.1.0-source.zip v1.1.0
```

完整归档可在独立目录解压使用，不将旧文件散落到当前根目录。

## 本机归档（2026-10-07）

| 原位置 | 当前位置 |
| --- | --- |
| `legacy/` | `_local/archive/2026-10-07/legacy/` |
| 旧 CLI、浏览器入口、根目录 `renderer.html` | `_local/archive/2026-10-07/cli/` |
| 旧历史打包脚本与阿米娅专用映射 | `_local/archive/2026-10-07/` |
| 根目录 EXE、`package/` | `_local/archive/2026-10-07/` |
| 旧 `build/` 缓存、截图、日志与逐帧输出 | `_local/archive/2026-10-07/old-cache/` |
| 旧解压目录和重复、无版本的 ZIP | `_local/archive/2026-10-07/old-release-builds/` |
| 改名前依赖链接失效的 `node_modules/` | `_local/archive/2026-10-07/broken-node_modules/` |
| `source/` | `_local/models/` |
| `dist/` | `_local/output/` |
| v1.0.0 ZIP 与 SHA-256 | `_local/releases/v1.0.0/` |
| v1.1.0 ZIP 与 SHA-256 | `_local/releases/v1.1.0/` |

这里的“移除”指从当前源码与 Git 当前版本移除，原文件已移动归档，仍可恢复。移走文件没有减少磁盘占用；归档中的解压副本和失效依赖若以后确定无需保留，可以再做磁盘清理。本机素材和转换结果保留完整内容。

`old-release-builds/spine-codex-converter.zip` 含历史测试模型，只作本地备份，不能当作公开 Release。公开历史安装包仍使用 `_local/releases/vX.Y.Z/` 下带版本号的 ZIP 与校验文件。
