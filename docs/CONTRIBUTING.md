# 参与开发与文档维护

## 分支与版本

- `main` 保存已验证的代码和文档，正式发行时再建立 `vX.Y.Z` 标签和 Release。
- 未验证的大改动使用本地功能分支；需要远程备份时推送到私人仓库。
- 开发流程以 [DEVELOPMENT](DEVELOPMENT.md) 为准，任务状态统一记录在 [TASKS](TASKS.md)。
- 历史源码通过 Git 标签保存，本地实验与构建副本集中到 `_local/`；说明见 [ARCHIVE](ARCHIVE.md)。
- 游戏模型、贴图、音频、转换结果、缓存和安装包不进入 Git。

## 在 Markdown 中插入图片

先把图片放入 `docs/images/`，文件名使用英文、数字和连字符，然后在根目录 README 中写：

```markdown
![转换器主界面](docs/images/converter-main.png)
```

在 `docs/` 目录中的 Markdown 文件里，路径改为：

```markdown
![转换器主界面](images/converter-main.png)
```

需要控制显示宽度时可以使用 HTML：

```html
<img src="docs/images/converter-main.png" alt="转换器主界面" width="720">
```

图片文件本身也必须提交到 Git。GitHub 路径区分大小写；尽量不用空格和中文文件名，以免链接难以维护。截图前应遮盖用户名、绝对路径、令牌和其他隐私信息。
