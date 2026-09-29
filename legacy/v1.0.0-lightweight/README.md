# v1.0.0 轻量版归档

这里保留首个公开版本使用的轻量入口，方便维护历史 Release，不作为当前版本的默认入口。

## 包含内容

- `gui/SpineCodexConverterGui.cs`：早期 WinForms 启动器源码。
- `build-gui.ps1`：启动器构建脚本。
- `convert-spine.cmd`：命令行快捷入口。
- `package.json`：归档版所需的最小依赖与命令。

这些入口仍依赖仓库根目录中的转换核心、网页界面和 Node.js 依赖。需要开箱即用体验时，请使用 v1.1.0 的 `SpineCodexConverter-Full-v1.1.0.zip`。

发布历史版时应从 `v1.0.0` Git 标签构建独立压缩包，且不得包含测试模型、游戏贴图、音频或转换结果。
