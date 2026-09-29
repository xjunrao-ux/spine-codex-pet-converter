using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Spine → Codex 桌宠转换器")]
[assembly: System.Reflection.AssemblyDescription("将 Spine 3.8 骨骼素材转换为 Codex 桌宠精灵表")]
[assembly: System.Reflection.AssemblyCompany("Local Codex Tools")]
[assembly: System.Reflection.AssemblyProduct("Spine Codex Pet Converter")]
[assembly: System.Reflection.AssemblyVersion("0.3.0.0")]

namespace SpineCodexPetConverter
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            var smokeTest = args.Any(arg => string.Equals(arg, "--smoke-test", StringComparison.OrdinalIgnoreCase));
            Application.Run(new MainForm(smokeTest));
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly string appRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        private readonly TextBox inputBox = new TextBox();
        private readonly TextBox outputBox = new TextBox();
        private readonly TextBox configBox = new TextBox();
        private readonly TextBox baseBox = new TextBox();
        private readonly TextBox idBox = new TextBox();
        private readonly TextBox nameBox = new TextBox();
        private readonly TextBox logBox = new TextBox();
        private readonly PictureBox previewBox = new PictureBox();
        private readonly Label dependencyLabel = new Label();
        private readonly Label statusLabel = new Label();
        private readonly ProgressBar progressBar = new ProgressBar();
        private readonly Button inspectButton = new Button();
        private readonly Button convertButton = new Button();
        private readonly Button setupButton = new Button();
        private readonly Button openOutputButton = new Button();
        private Process activeProcess;
        private string lastDefaultOutput = string.Empty;

        private static readonly Color Background = Color.FromArgb(244, 246, 250);
        private static readonly Color Card = Color.White;
        private static readonly Color Primary = Color.FromArgb(38, 94, 234);
        private static readonly Color TextMain = Color.FromArgb(34, 40, 53);
        private static readonly Color TextMuted = Color.FromArgb(100, 109, 126);
        private static readonly Color Border = Color.FromArgb(218, 223, 232);

        public MainForm(bool smokeTest)
        {
            Text = "Spine → Codex 桌宠转换器";
            BackColor = Background;
            ForeColor = TextMain;
            Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(920, 650);
            ClientSize = new Size(1080, 740);
            AutoScaleMode = AutoScaleMode.Dpi;
            AllowDrop = true;

            BuildUi();
            WireEvents();
            RefreshDependencyState();

            var bundledSource = Path.Combine(appRoot, "source");
            if (Directory.Exists(bundledSource)) SetInputFolder(bundledSource);

            if (smokeTest)
            {
                Opacity = 0;
                Shown += delegate
                {
                    var timer = new Timer { Interval = 900 };
                    timer.Tick += delegate { timer.Stop(); timer.Dispose(); Close(); };
                    timer.Start();
                };
            }
        }

        private void BuildUi()
        {
            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4,
                Padding = new Padding(22, 18, 22, 18),
                BackColor = Background,
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 66));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 62));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 38));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            Controls.Add(root);

            var header = new Panel { Dock = DockStyle.Fill, BackColor = Background };
            var title = new Label
            {
                Text = "Spine → Codex 桌宠转换器",
                AutoSize = true,
                Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(0, 0),
            };
            var subtitle = new Label
            {
                Text = "选择 Spine 3.8 素材文件夹，一键生成可上传的 1536 × 1872 透明精灵表",
                AutoSize = true,
                ForeColor = TextMuted,
                Location = new Point(2, 39),
            };
            header.Controls.Add(title);
            header.Controls.Add(subtitle);
            root.Controls.Add(header, 0, 0);

            var workspace = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Margin = new Padding(0, 0, 0, 12),
            };
            workspace.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 56));
            workspace.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 44));
            root.Controls.Add(workspace, 0, 1);

            var settingsCard = CreateCard();
            settingsCard.Padding = new Padding(18, 16, 18, 14);
            settingsCard.Margin = new Padding(0, 0, 12, 0);
            workspace.Controls.Add(settingsCard, 0, 0);

            var settings = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 8,
                BackColor = Card,
            };
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 98));
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 76));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
            settings.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
            settingsCard.Controls.Add(settings);

            AddPathRow(settings, 0, "素材文件夹", inputBox, "浏览…", BrowseInput);
            AddPathRow(settings, 1, "输出文件夹", outputBox, "浏览…", BrowseOutput);
            AddPathRow(settings, 2, "映射配置", configBox, "选择…", BrowseConfig);
            AddFieldRow(settings, 3, "骨骼基名", baseBox, "多个 .skel 时填写，不含扩展名");
            AddFieldRow(settings, 4, "宠物 ID", idBox, "可选；建议英文、数字和连字符");
            AddFieldRow(settings, 5, "显示名称", nameBox, "可选；显示在宠物选择器中");

            dependencyLabel.AutoSize = false;
            dependencyLabel.Dock = DockStyle.Fill;
            dependencyLabel.TextAlign = ContentAlignment.MiddleLeft;
            dependencyLabel.ForeColor = TextMuted;
            dependencyLabel.Padding = new Padding(2, 2, 0, 0);
            settings.SetColumnSpan(dependencyLabel, 2);
            settings.Controls.Add(dependencyLabel, 0, 6);

            setupButton.Text = "安装/检查依赖";
            StyleSecondaryButton(setupButton);
            setupButton.Dock = DockStyle.Top;
            setupButton.Height = 34;
            setupButton.Margin = new Padding(6, 9, 0, 0);
            settings.Controls.Add(setupButton, 2, 6);

            inspectButton.Text = "检查动画";
            StyleSecondaryButton(inspectButton);
            inspectButton.Dock = DockStyle.Fill;
            inspectButton.Margin = new Padding(0, 4, 8, 0);
            settings.Controls.Add(inspectButton, 0, 7);

            convertButton.Text = "开始转换";
            StylePrimaryButton(convertButton);
            convertButton.Dock = DockStyle.Fill;
            convertButton.Margin = new Padding(0, 4, 0, 0);
            settings.SetColumnSpan(convertButton, 2);
            settings.Controls.Add(convertButton, 1, 7);

            var previewCard = CreateCard();
            previewCard.Padding = new Padding(14);
            previewCard.Margin = new Padding(0);
            workspace.Controls.Add(previewCard, 1, 0);

            var previewLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                BackColor = Card,
            };
            previewLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
            previewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            var previewTitle = new Label
            {
                Text = "输出预览",
                Dock = DockStyle.Fill,
                Font = new Font(Font, FontStyle.Bold),
                ForeColor = TextMain,
            };
            previewBox.Dock = DockStyle.Fill;
            previewBox.SizeMode = PictureBoxSizeMode.Zoom;
            previewBox.BackColor = Color.FromArgb(232, 235, 241);
            previewBox.BorderStyle = BorderStyle.FixedSingle;
            previewLayout.Controls.Add(previewTitle, 0, 0);
            previewLayout.Controls.Add(previewBox, 0, 1);
            previewCard.Controls.Add(previewLayout);

            var logCard = CreateCard();
            logCard.Padding = new Padding(14, 10, 14, 12);
            logCard.Margin = new Padding(0, 0, 0, 10);
            root.Controls.Add(logCard, 0, 2);
            var logLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                BackColor = Card,
            };
            logLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
            logLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            var logTitle = new Label
            {
                Text = "运行日志",
                Dock = DockStyle.Fill,
                Font = new Font(Font, FontStyle.Bold),
            };
            logBox.Dock = DockStyle.Fill;
            logBox.Multiline = true;
            logBox.ReadOnly = true;
            logBox.ScrollBars = ScrollBars.Both;
            logBox.WordWrap = false;
            logBox.BackColor = Color.FromArgb(29, 34, 45);
            logBox.ForeColor = Color.FromArgb(224, 231, 243);
            logBox.BorderStyle = BorderStyle.None;
            logBox.Font = new Font("Consolas", 9F);
            logLayout.Controls.Add(logTitle, 0, 0);
            logLayout.Controls.Add(logBox, 0, 1);
            logCard.Controls.Add(logLayout);

            var footer = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 1,
                BackColor = Background,
            };
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170));
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 128));
            statusLabel.Text = "就绪 · 可将素材文件夹拖到窗口中";
            statusLabel.Dock = DockStyle.Fill;
            statusLabel.TextAlign = ContentAlignment.MiddleLeft;
            statusLabel.ForeColor = TextMuted;
            progressBar.Dock = DockStyle.Fill;
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 22;
            progressBar.Visible = false;
            progressBar.Margin = new Padding(8, 10, 12, 9);
            openOutputButton.Text = "打开输出目录";
            StyleSecondaryButton(openOutputButton);
            openOutputButton.Dock = DockStyle.Fill;
            openOutputButton.Margin = new Padding(0, 4, 0, 2);
            footer.Controls.Add(statusLabel, 0, 0);
            footer.Controls.Add(progressBar, 1, 0);
            footer.Controls.Add(openOutputButton, 2, 0);
            root.Controls.Add(footer, 0, 3);
        }

        private Panel CreateCard()
        {
            return new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Card,
                BorderStyle = BorderStyle.FixedSingle,
            };
        }

        private void AddPathRow(TableLayoutPanel table, int row, string labelText, TextBox box, string buttonText, EventHandler handler)
        {
            AddLabel(table, row, labelText);
            StyleTextBox(box);
            box.Dock = DockStyle.Fill;
            box.Margin = new Padding(0, 7, 8, 7);
            table.Controls.Add(box, 1, row);
            var button = new Button { Text = buttonText, Dock = DockStyle.Fill, Margin = new Padding(0, 6, 0, 6) };
            StyleSecondaryButton(button);
            button.Click += handler;
            table.Controls.Add(button, 2, row);
        }

        private void AddFieldRow(TableLayoutPanel table, int row, string labelText, TextBox box, string placeholder)
        {
            AddLabel(table, row, labelText);
            StyleTextBox(box);
            box.Dock = DockStyle.Fill;
            box.Margin = new Padding(0, 7, 0, 7);
            box.Tag = placeholder;
            table.SetColumnSpan(box, 2);
            table.Controls.Add(box, 1, row);
        }

        private void AddLabel(TableLayoutPanel table, int row, string text)
        {
            var label = new Label
            {
                Text = text,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = TextMain,
                Margin = new Padding(0),
            };
            table.Controls.Add(label, 0, row);
        }

        private static void StyleTextBox(TextBox box)
        {
            box.BorderStyle = BorderStyle.FixedSingle;
            box.BackColor = Color.White;
            box.ForeColor = TextMain;
        }

        private static void StylePrimaryButton(Button button)
        {
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = Primary;
            button.ForeColor = Color.White;
            button.Cursor = Cursors.Hand;
            button.Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Bold);
        }

        private static void StyleSecondaryButton(Button button)
        {
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = Border;
            button.FlatAppearance.BorderSize = 1;
            button.BackColor = Color.White;
            button.ForeColor = TextMain;
            button.Cursor = Cursors.Hand;
        }

        private void WireEvents()
        {
            inputBox.TextChanged += delegate { HandleInputChanged(); };
            outputBox.TextChanged += delegate { RefreshPreview(); };
            inspectButton.Click += delegate { RunConverter(true); };
            convertButton.Click += delegate { RunConverter(false); };
            setupButton.Click += delegate { InstallDependencies(); };
            openOutputButton.Click += delegate { OpenOutputFolder(); };
            DragEnter += HandleDragEnter;
            DragDrop += HandleDragDrop;
            FormClosing += delegate(object sender, FormClosingEventArgs e)
            {
                if (activeProcess != null && !activeProcess.HasExited)
                {
                    var result = MessageBox.Show("转换仍在运行，确定要关闭工具吗？", "确认关闭", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                    if (result != DialogResult.Yes) e.Cancel = true;
                }
            };
        }

        private void BrowseInput(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择包含 .skel、.atlas 和纹理图片的文件夹";
                dialog.SelectedPath = Directory.Exists(inputBox.Text) ? inputBox.Text : appRoot;
                if (dialog.ShowDialog(this) == DialogResult.OK) SetInputFolder(dialog.SelectedPath);
            }
        }

        private void BrowseOutput(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择输出文件夹";
                dialog.SelectedPath = Directory.Exists(outputBox.Text) ? outputBox.Text : appRoot;
                if (dialog.ShowDialog(this) == DialogResult.OK) outputBox.Text = dialog.SelectedPath;
            }
        }

        private void BrowseConfig(object sender, EventArgs e)
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Title = "选择动画映射配置";
                dialog.Filter = "JSON 配置 (*.json)|*.json|所有文件 (*.*)|*.*";
                dialog.InitialDirectory = Directory.Exists(inputBox.Text) ? inputBox.Text : appRoot;
                if (dialog.ShowDialog(this) == DialogResult.OK) configBox.Text = dialog.FileName;
            }
        }

        private void HandleInputChanged()
        {
            var input = inputBox.Text.Trim();
            if (!Directory.Exists(input)) return;

            var defaultOutput = Path.Combine(input, "codex-pet-output");
            if (string.IsNullOrWhiteSpace(outputBox.Text) || string.Equals(outputBox.Text, lastDefaultOutput, StringComparison.OrdinalIgnoreCase))
            {
                outputBox.Text = defaultOutput;
            }
            lastDefaultOutput = defaultOutput;

            var conventionalConfig = Path.Combine(input, "codex-pet.config.json");
            if (File.Exists(conventionalConfig)) configBox.Text = conventionalConfig;
            else if (!string.IsNullOrWhiteSpace(configBox.Text) && !File.Exists(configBox.Text)) configBox.Clear();

            statusLabel.Text = "已选择素材文件夹";
        }

        private void SetInputFolder(string path)
        {
            inputBox.Text = Path.GetFullPath(path);
        }

        private void HandleDragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent(DataFormats.FileDrop))
            {
                var paths = (string[])e.Data.GetData(DataFormats.FileDrop);
                if (paths.Length > 0 && Directory.Exists(paths[0])) e.Effect = DragDropEffects.Copy;
            }
        }

        private void HandleDragDrop(object sender, DragEventArgs e)
        {
            var paths = (string[])e.Data.GetData(DataFormats.FileDrop);
            if (paths.Length > 0 && Directory.Exists(paths[0])) SetInputFolder(paths[0]);
        }

        private void RunConverter(bool inspectOnly)
        {
            if (!CheckReady()) return;
            if (!Directory.Exists(inputBox.Text.Trim()))
            {
                MessageBox.Show(this, "请选择有效的素材文件夹。", "缺少素材", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            if (!inspectOnly && string.IsNullOrWhiteSpace(outputBox.Text))
            {
                MessageBox.Show(this, "请选择输出文件夹。", "缺少输出位置", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            if (!string.IsNullOrWhiteSpace(configBox.Text) && !File.Exists(configBox.Text.Trim()))
            {
                MessageBox.Show(this, "映射配置文件不存在。", "配置错误", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var script = Path.Combine(appRoot, "scripts", "convert-spine.mjs");
            var arguments = new StringBuilder();
            arguments.Append(Quote(script));
            arguments.Append(" --input ").Append(Quote(inputBox.Text.Trim()));
            if (!inspectOnly) arguments.Append(" --output ").Append(Quote(outputBox.Text.Trim()));
            AddOptionalArgument(arguments, "--config", configBox.Text);
            AddOptionalArgument(arguments, "--base", baseBox.Text);
            AddOptionalArgument(arguments, "--id", idBox.Text);
            AddOptionalArgument(arguments, "--name", nameBox.Text);
            if (inspectOnly) arguments.Append(" --inspect");

            logBox.Clear();
            AppendLog(inspectOnly ? "正在检查动画与自动映射…" : "正在转换，请稍候…");
            StartProcess("node", arguments.ToString(), inspectOnly ? "检查动画" : "转换", delegate(int exitCode)
            {
                if (exitCode == 0 && !inspectOnly)
                {
                    RefreshPreview();
                    statusLabel.Text = "转换完成，输出已经通过尺寸与透明度校验";
                    MessageBox.Show(this, "转换完成。\n\n已生成 spritesheet.webp 和 pet.json。", "成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else if (exitCode == 0)
                {
                    statusLabel.Text = "检查完成，动画映射已显示在日志中";
                }
            });
        }

        private void InstallDependencies()
        {
            logBox.Clear();
            AppendLog("正在检查并安装转换引擎依赖…");
            var installCommand = CommandOnPathExists("pnpm.cmd") || CommandOnPathExists("pnpm.exe")
                ? "pnpm install --frozen-lockfile"
                : "npm install";
            AppendLog("使用：" + installCommand);
            StartProcess("cmd.exe", "/d /s /c \"" + installCommand + "\"", "安装依赖", delegate(int exitCode)
            {
                RefreshDependencyState();
                if (exitCode == 0)
                {
                    statusLabel.Text = "依赖安装完成";
                    MessageBox.Show(this, "转换引擎依赖已经准备好。", "安装完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            });
        }

        private bool CheckReady()
        {
            if (activeProcess != null && !activeProcess.HasExited) return false;
            if (!File.Exists(Path.Combine(appRoot, "scripts", "convert-spine.mjs")))
            {
                MessageBox.Show(this, "找不到 scripts\\convert-spine.mjs。请保持 EXE 与项目文件夹结构不变。", "文件缺失", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            }
            if (!DependenciesInstalled())
            {
                MessageBox.Show(this, "转换引擎依赖尚未安装，请先点击“安装/检查依赖”。", "需要初始化", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
            return true;
        }

        private bool DependenciesInstalled()
        {
            return File.Exists(Path.Combine(appRoot, "node_modules", "sharp", "package.json"))
                && File.Exists(Path.Combine(appRoot, "node_modules", "pixi.js", "package.json"))
                && File.Exists(Path.Combine(appRoot, "node_modules", "puppeteer-core", "package.json"));
        }

        private void RefreshDependencyState()
        {
            if (DependenciesInstalled())
            {
                dependencyLabel.Text = "● 转换引擎已就绪（使用系统 Edge，不内置浏览器）";
                dependencyLabel.ForeColor = Color.FromArgb(28, 133, 83);
                setupButton.Text = "重新检查";
            }
            else
            {
                dependencyLabel.Text = "● 首次使用需要安装依赖（需要 Node.js）";
                dependencyLabel.ForeColor = Color.FromArgb(181, 99, 20);
                setupButton.Text = "安装依赖";
            }
        }

        private void StartProcess(string fileName, string arguments, string actionName, Action<int> completed)
        {
            SetBusy(true, actionName + "中…");
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = fileName,
                        Arguments = arguments,
                        WorkingDirectory = appRoot,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        StandardOutputEncoding = Encoding.UTF8,
                        StandardErrorEncoding = Encoding.UTF8,
                    },
                    EnableRaisingEvents = true,
                };
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) AppendLog(e.Data); };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) AppendLog(e.Data); };
                process.Exited += delegate
                {
                    process.WaitForExit();
                    var exitCode = process.ExitCode;
                    BeginInvoke((MethodInvoker)delegate
                    {
                        activeProcess = null;
                        SetBusy(false, exitCode == 0 ? actionName + "完成" : actionName + "失败");
                        AppendLog(exitCode == 0 ? "\r\n✓ 操作完成" : "\r\n✗ 操作失败，退出代码：" + exitCode);
                        if (exitCode != 0)
                        {
                            MessageBox.Show(this, "操作失败，请查看运行日志。", actionName + "失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                        completed(exitCode);
                        process.Dispose();
                    });
                };
                activeProcess = process;
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                activeProcess = null;
                SetBusy(false, actionName + "失败");
                AppendLog(ex.ToString());
                MessageBox.Show(this, "无法启动转换程序：\n" + ex.Message, actionName + "失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void SetBusy(bool busy, string status)
        {
            inspectButton.Enabled = !busy;
            convertButton.Enabled = !busy;
            setupButton.Enabled = !busy;
            progressBar.Visible = busy;
            statusLabel.Text = status;
        }

        private void AppendLog(string text)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke((MethodInvoker)delegate { AppendLog(text); });
                return;
            }
            logBox.AppendText(text + Environment.NewLine);
            logBox.SelectionStart = logBox.TextLength;
            logBox.ScrollToCaret();
        }

        private void RefreshPreview()
        {
            if (InvokeRequired)
            {
                BeginInvoke((MethodInvoker)RefreshPreview);
                return;
            }
            var preview = Path.Combine(outputBox.Text.Trim(), "spritesheet-preview.png");
            if (!File.Exists(preview)) return;
            try
            {
                using (var stream = new FileStream(preview, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var loaded = Image.FromStream(stream))
                {
                    var copy = new Bitmap(loaded);
                    var previous = previewBox.Image;
                    previewBox.Image = copy;
                    if (previous != null) previous.Dispose();
                }
            }
            catch (Exception ex)
            {
                AppendLog("预览加载失败：" + ex.Message);
            }
        }

        private void OpenOutputFolder()
        {
            var output = outputBox.Text.Trim();
            if (!Directory.Exists(output))
            {
                MessageBox.Show(this, "输出文件夹尚不存在，请先完成转换。", "暂无输出", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Process.Start(new ProcessStartInfo("explorer.exe", Quote(output)) { UseShellExecute = true });
        }

        private static void AddOptionalArgument(StringBuilder builder, string name, string value)
        {
            if (!string.IsNullOrWhiteSpace(value)) builder.Append(' ').Append(name).Append(' ').Append(Quote(value.Trim()));
        }

        private static bool CommandOnPathExists(string command)
        {
            var pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            foreach (var rawDirectory in pathValue.Split(Path.PathSeparator))
            {
                var directory = rawDirectory.Trim().Trim('"');
                if (directory.Length > 0 && File.Exists(Path.Combine(directory, command))) return true;
            }
            return false;
        }

        private static string Quote(string value)
        {
            if (value == null) return "\"\"";
            var quoted = new StringBuilder("\"");
            var backslashes = 0;
            foreach (var character in value)
            {
                if (character == '\\')
                {
                    backslashes += 1;
                    continue;
                }
                if (character == '"')
                {
                    quoted.Append('\\', backslashes * 2 + 1);
                    quoted.Append('"');
                    backslashes = 0;
                    continue;
                }
                quoted.Append('\\', backslashes);
                backslashes = 0;
                quoted.Append(character);
            }
            quoted.Append('\\', backslashes * 2);
            quoted.Append('"');
            return quoted.ToString();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && previewBox.Image != null) previewBox.Image.Dispose();
            base.Dispose(disposing);
        }
    }
}
