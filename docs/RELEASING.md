# 发布流程

只有经过验收的版本才允许进入公共仓库的 `main` 分支和 GitHub Releases。

## 发布检查

1. 将根目录与 `desktop-app/package.json` 的版本都更新为目标版本。
2. 更新 `CHANGELOG.md`、`README.md` 和必要的使用说明。
3. 执行 `node scripts/validate.mjs`。
4. 执行 `node desktop/build-desktop.mjs`。
5. 执行 `powershell -ExecutionPolicy Bypass -File .\package-desktop.ps1`。
6. 在一台没有 Node.js 开发环境的 Windows 机器或干净账户中验证完整版。
7. 为待上传文件生成按版本命名的 SHA-256 清单。
8. 确认 `git status --short` 不包含模型、转换结果、缓存或安装包。

## Git 发布

```powershell
git switch main
git add -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Spine Codex Pet Converter vX.Y.Z"
git push public main
git push public vX.Y.Z
```

在 GitHub 为该标签创建 Release，上传：

```text
SpineCodexConverter-Full-vX.Y.Z.zip
SHA256SUMS-vX.Y.Z.txt
```

v1.0.0 的轻量版 Release 使用 `SpineCodexConverter-Lightweight-v1.0.0.zip`。历史 Release 一经发布不再用新源码覆盖；如必须修复，应发布新的修订号。

首次补建 v1.0.0 历史轻量包时运行：

```powershell
corepack pnpm package:legacy
```

该脚本只从 `v1.0.0` 标签提取转换核心和轻量启动器，不会纳入 `source/`、Electron 完整版或实验性对话工具。

开发中版本只保存在本地分支或私人仓库，不创建公共标签。

仓库使用 `.githooks/pre-push` 保护名为 `public` 的远程：开发分支会被拒绝，`main` 只有在提交点存在 `vX.Y.Z` 标签时才能推送。首次克隆后运行：

```powershell
git config core.hooksPath .githooks
```
