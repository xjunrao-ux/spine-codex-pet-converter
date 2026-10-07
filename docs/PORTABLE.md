# Spine → Codex 桌宠转换器

完整解压本 ZIP，然后双击同目录的 `SpineCodexConverter.exe`。无需安装 Node.js。程序实际版本可以查看 `resources/app/package.json` 中的 `version` 字段。

1. 准备 Spine 3.8 的 `.skel`、同名 `.atlas` 和全部贴图。
2. 在程序中选择素材文件夹，点击“检查动画”。
3. 确认映射和人物大小，选择输出目录，再点击“开始转换”。
4. 在 `C:\Users\你的用户名\.codex\pets\桌宠ID\` 创建桌宠文件夹，把生成的 `pet.json` 和 `spritesheet.webp` 放入其中。
5. 打开 Codex 的 Settings → Pets，点击 Refresh 并选择桌宠。

完整字段与故障排查见同目录的 [USAGE.md](USAGE.md)。

请只转换拥有使用许可的素材；生成桌宠文件不授予角色、贴图或动画的再分发权。此软件包不附带游戏模型。

项目、更新与问题反馈：[GitHub 仓库](https://github.com/xjunrao-ux/spine-codex-pet-converter)。
