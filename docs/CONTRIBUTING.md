# 参与开发与文档维护

## 分支与版本

- `main` 只保留经过验证的正式版本，每个正式提交对应一个 `vX.Y.Z` 标签。
- 开发中代码使用本地分支或私人远程仓库，不直接推送到公共 `main`。
- `legacy/` 只用于说明和维护历史实现，不把开发中失败副本继续堆在根目录。
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
