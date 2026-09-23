# 发布流程

只有经过验收的版本才允许进入公共仓库的 `main` 分支和 GitHub Releases。

## 发布检查

1. 将 `package.json` 版本更新为目标版本。
2. 更新 `CHANGELOG.md`、`README.md` 和必要的使用说明。
3. 执行 `node scripts/validate.mjs`。
4. 执行 `node desktop/build-desktop.mjs`。
5. 执行 `powershell -ExecutionPolicy Bypass -File .\package-desktop.ps1`。
6. 在一台没有 Node.js 开发环境的 Windows 机器或干净账户中验证完整版。
7. 为待上传文件生成 SHA-256。
8. 确认 `git status --short` 不包含模型、转换结果、缓存或安装包。

## Git 发布

```powershell
git switch main
git add -A
git commit -m "release: v1.0.0"
git tag -a v1.0.0 -m "Spine Codex Pet Converter v1.0.0"
git push public main
git push public v1.0.0
```

在 GitHub 为该标签创建 Release，上传：

```text
SpineCodexConverter-Full.zip
SHA256SUMS.txt
```

开发中版本只保存在本地分支或私人仓库，不创建公共标签。

仓库使用 `.githooks/pre-push` 保护名为 `public` 的远程：开发分支会被拒绝，`main` 只有在提交点存在 `vX.Y.Z` 标签时才能推送。首次克隆后运行：

```powershell
git config core.hooksPath .githooks
```
