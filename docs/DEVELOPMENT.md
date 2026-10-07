# 个人开发流程

仓库只维护一套当前源码。Git 保存代码与文档的修改历史；标签确定正式代码版本；GitHub Release 提供用户下载的软件包。提交可以频繁进行，发布只在验收通过后进行。

## 日常开发

1. 在 [TASKS](TASKS.md) 记录任务的目的、范围、验收标准和目标版本。
2. 大改动使用短期本地分支，例如 `chore/repository-cleanup`、`feature/mapping-editor` 或 `fix/texture-path`。
3. 修改代码时同步修改使用说明；对用户有影响的变化记录到 CHANGELOG 的“未发布”部分。
4. 执行自动检查和构建，再验证本次涉及的操作。通过后提交并合并到 `main`。
5. 推送已验证的 `main`。未验证分支只留在本机，或备份到私人远程。

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm build:desktop
pnpm start
```

使用 Windows、Node.js 24 和 pnpm 11.19.0。`pnpm start` 打开当前桌面应用。素材可放在 `_local/models/`，输出可选择 `_local/output/`。校验实际转换结果：

```powershell
pnpm validate --dir "D:\转换结果"
```

界面转换包含自身的校验；独立结果校验还会严格检查逐格透明区域与边缘触碰。`pnpm check` 检查源码语法、版本号一致性、示例 JSON 与文档本地链接。GitHub Actions 自动执行检查、渲染构建和图标构建；没有把私有角色模型放入 CI。

## 提交与推送

一次提交尽量处理一件事，例如 `fix: handle missing texture` 或 `docs: update installation guide`。提交前看 `git diff` 与 `git status`；只加入本次相关文件。

```powershell
git add src scripts docs examples package.json pnpm-lock.yaml
git diff --cached --stat
git commit -m "chore: organize converter repository"
git push public main
```

上面是示例，实际暂存范围按修改调整。普通提交不需要新增版本标签。推送钩子限制 `public` 只接收 `main` 与 `vX.Y.Z` 标签，但不要求每个提交都成为 Release。

## 文档和发布

- README：用途、下载、快速开始和文档入口。
- USAGE：用户操作与故障排查。
- TASKS：开发范围、状态和未来版本方向。
- ARCHITECTURE：模块关系和关键设计取舍。
- CHANGELOG：正式版与未发布变化。
- RELEASING：检查、标签、发布包、恢复流程。

发布前更新根目录与 `src/app/package.json` 的版本号，通过 [发布流程](RELEASING.md) 完成标签与 Release。已经发布的标签和 ZIP 不覆盖；历史文档通过对应标签查看。
