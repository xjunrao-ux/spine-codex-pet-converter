# v1.0 使用说明

## 推荐使用方式

从 GitHub Releases 下载 `SpineCodexConverter-Full.zip`，完整解压后运行 `SpineCodexConverter.exe`。不要直接在压缩包预览窗口中启动程序。

1. 点击“选择素材文件夹”，选择包含 `.skel`、`.atlas` 和贴图的目录。
2. 选择输出目录；未指定时使用素材目录下的 `codex-pet-output`。
3. 点击“检查动画”，确认自动识别的动作。
4. 必要时选择动画映射 JSON、填写骨骼基名、宠物 ID 和显示名字。
5. 点击“开始转换”。进度区域会显示当前动画、帧数和总体百分比。
6. 完成后查看 `spritesheet-preview.png` 和 `conversion-report.json`。

## 高级字段

- `动画映射配置`：指定 Codex 状态与 Spine 动画的对应关系；留空时自动识别。
- `骨骼基名`：目录中存在多个 `.skel` 时指定目标文件名，不含扩展名。
- `宠物 ID`：仅使用稳定的英文、数字和连字符，例如 `my-character`。
- `显示名字`：在 Codex 宠物选择器中显示的名字。

可以复制 `codex-pet.config.example.json` 作为自定义映射模板。

## 命令行

```powershell
node scripts/convert-spine.mjs --input "D:\model"
```

常用参数：

```text
--output <folder>   指定输出目录
--config <json>     指定动画映射配置
--base <name>       指定骨骼基名
--id <slug>         指定宠物 ID
--name <text>       指定显示名称
--inspect           只检查动画，不生成文件
```

## 常见问题

### 找不到纹理

确认 `.atlas` 中列出的所有图片都和 `.atlas` 位于同一目录，文件名及大小写完全一致。

### 动作识别不正确

先执行“检查动画”，再通过配置文件显式指定映射。转换报告会记录最终采用的动画。

### 画面被裁切

降低人物缩放比例，并检查报告中的越界警告。超过 100% 的比例更容易触碰单元格边缘。

### 如何安装到 Codex

转换完成后，将 `pet.json` 和 `spritesheet.webp` 一起复制到 Codex 自定义桌宠要求的目录；两者不能改成不同的基础名称或分开放置。
