# Spine → Codex 桌宠转换器 v1.0.0

首个公开历史版本，面向希望使用轻量启动器或命令行的 Windows 10/11 用户。

## 下载

- `SpineCodexConverter-Lightweight-v1.0.0.zip`：早期轻量版，需要 Node.js，并调用 Edge/Chrome 打开转换界面。
- `SHA256SUMS-v1.0.0.txt`：下载完整性校验值。

请不要把 GitHub 自动生成的 `Source code.zip` 当作普通用户软件包。

## 首次使用

1. 安装 Node.js 20 或更高版本。
2. 完整解压 `SpineCodexConverter-Lightweight-v1.0.0.zip`。
3. 在解压目录执行 `npm install`。
4. 双击 `SpineCodexConverter.exe`，或运行 `convert-spine.cmd` 使用命令行入口。
5. 选择包含 `.skel`、`.atlas` 和贴图的文件夹，先检查动画，再执行转换。

## 主要能力

- 自动动画映射和自定义映射配置。
- 九状态 Codex 精灵表输出。
- 人物缩放、裁边检测、预览图和转换报告。
- 轻量 WinForms 启动器、系统浏览器界面和命令行模式。

此历史版本不再增加功能。当前推荐版本为 v1.1.0；当前仓库中的历史实现归档于 [`legacy/v1.0.0-lightweight`](../legacy/v1.0.0-lightweight/)，当时的完整源码可通过 Git 标签 `v1.0.0` 查看。

发布包不含测试角色、模型或转换结果。请只处理你有权使用的素材；能下载不等于可以再分发。
