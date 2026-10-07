# 发布流程

`main` 保存经过验证的代码和文档。普通提交可以推送，但不会自动成为正式版本；只有版本标签与 GitHub Release 才表示一次正式交付。

## 发布检查

1. 从任务清单选定本次范围，确认任务验收通过。
2. 将根目录和 `src/app/package.json` 都更新为新的版本号，已发布版本不重用。
3. 把 CHANGELOG 的“未发布”内容归入新版本，更新 README、USAGE 和对应版本说明。
4. 执行 `pnpm check`、`pnpm build:desktop`、`pnpm build:icon`。
5. 在界面测试选择素材、动画检查、转换、预览、输出目录和错误提示；对结果执行 `pnpm validate --dir "输出目录"`。
6. 提交本次代码与文档，并在该提交创建新标签。
7. 从标签构建发行包：`pnpm package:desktop`。工作区应没有尚未提交的源码改动。
8. 完整解压 ZIP，在没有 Node.js 开发环境的 Windows 机器或干净账户验证 EXE。
9. 确认 ZIP 不包含私人素材、模型、测试输出或开发缓存，然后推送标签和创建 Release。

输出位于 `_local/releases/vX.Y.Z/`：完整解压目录、ZIP 与 SHA-256 清单。打包脚本会拒绝覆盖任何已有的同版本产物；失败的临时构建需要先归档，再重新构建。

## Git 发布

```powershell
git switch main
git status --short
# 只暂存本次发布相关代码和文档
git add src scripts docs examples README.md CHANGELOG.md package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Spine Codex Pet Converter vX.Y.Z"
pnpm package:desktop
# 验证 ZIP 后推送，X.Y.Z 替换为真实版本号
git push --atomic public main vX.Y.Z
```

在 GitHub 为该标签创建 Release，上传：

```text
SpineCodexConverter-Full-vX.Y.Z.zip
SHA256SUMS-vX.Y.Z.txt
```

Release 说明中链接对应标签的文档，例如 `https://github.com/xjunrao-ux/spine-codex-pet-converter/blob/vX.Y.Z/docs/USAGE.md`，不要把历史 Release 的文档入口指向开发中的 `main`。

v1.0.0 的轻量版包保留在 `_local/releases/v1.0.0/`。历史 Release 不用新源码覆盖；维护旧版本需要从旧标签恢复完整源码，方法见 [ARCHIVE](ARCHIVE.md)。

未验证的开发版本只保存在本地分支或私人仓库，不创建正式公共标签。仓库推送钩子允许 `public/main` 的普通维护提交，但拒绝其他公共开发分支和非 `vX.Y.Z` 标签。首次克隆后运行：

```powershell
git config core.hooksPath .githooks
```

## 恢复

发行包出现问题时，保留出错版本用于追溯，让用户使用上一版 Release，同时修复并发布新版本；不强推重写已经公开的标签。此转换器没有用户数据库迁移，模型和转换结果保存在用户选择的目录，软件回退不需要删除这些文件。
