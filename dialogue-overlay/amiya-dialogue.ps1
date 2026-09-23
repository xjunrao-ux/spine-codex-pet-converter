param(
    [switch]$ValidateOnly,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot 'dialogue.json'
$pidPath = Join-Path $PSScriptRoot '.amiya-dialogue.pid'

function Read-DialogueConfig {
    if (-not (Test-Path -LiteralPath $configPath)) {
        throw "Missing dialogue configuration: $configPath"
    }

    $loadedConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath $configPath | ConvertFrom-Json
    if (-not $loadedConfig.lines -or $loadedConfig.lines.Count -lt 1) {
        throw 'dialogue.json must contain at least one line.'
    }
    if ($loadedConfig.intervalMinSeconds -lt 1) {
        throw 'intervalMinSeconds must be at least 1.'
    }
    if ($loadedConfig.intervalMaxSeconds -lt $loadedConfig.intervalMinSeconds) {
        throw 'intervalMaxSeconds must be greater than or equal to intervalMinSeconds.'
    }
    if ($loadedConfig.displaySeconds -lt 1) {
        throw 'displaySeconds must be at least 1.'
    }
    return $loadedConfig
}

function Stop-ExistingOverlay {
    if (-not (Test-Path -LiteralPath $pidPath)) {
        return $false
    }

    $savedPid = (Get-Content -Raw -LiteralPath $pidPath).Trim()
    if ($savedPid -match '^\d+$') {
        $existingProcess = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
        if ($existingProcess) {
            Stop-Process -Id $existingProcess.Id
        }
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    return $true
}

if ($Stop) {
    if (Stop-ExistingOverlay) {
        Write-Output 'Amiya dialogue overlay stopped.'
    } else {
        Write-Output 'Amiya dialogue overlay is not running.'
    }
    exit 0
}

$config = Read-DialogueConfig
if ($ValidateOnly) {
    Write-Output ("OK: {0} dialogue lines, interval {1}-{2}s, visible {3}s" -f `
        $config.lines.Count,
        $config.intervalMinSeconds,
        $config.intervalMaxSeconds,
        $config.displaySeconds)
    exit 0
}

if (Test-Path -LiteralPath $pidPath) {
    $savedPid = (Get-Content -Raw -LiteralPath $pidPath).Trim()
    if ($savedPid -match '^\d+$' -and (Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue)) {
        exit 0
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

Set-Content -LiteralPath $pidPath -Value $PID -Encoding ascii

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$application = New-Object System.Windows.Application
$application.ShutdownMode = [System.Windows.ShutdownMode]::OnExplicitShutdown

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Width="350" Height="142"
        WindowStyle="None"
        ResizeMode="NoResize"
        AllowsTransparency="True"
        Background="Transparent"
        ShowInTaskbar="False"
        ShowActivated="False"
        Topmost="True"
        Opacity="0">
    <Grid Margin="12">
        <Border CornerRadius="18"
                Background="#F7FBFF"
                BorderBrush="#67B9D8"
                BorderThickness="2"
                Padding="20,15,20,16">
            <Border.Effect>
                <DropShadowEffect Color="#66000000" BlurRadius="16" ShadowDepth="4" Opacity="0.45" />
            </Border.Effect>
            <StackPanel>
                <TextBlock x:Name="SpeakerText"
                           Foreground="#1682A8"
                           FontFamily="Microsoft YaHei UI"
                           FontSize="14"
                           FontWeight="SemiBold"
                           Margin="0,0,0,7" />
                <TextBlock x:Name="QuoteText"
                           Foreground="#162633"
                           FontFamily="Microsoft YaHei UI"
                           FontSize="17"
                           TextWrapping="Wrap"
                           LineHeight="25" />
            </StackPanel>
        </Border>
        <Path Data="M 0 0 L 20 0 L 7 17 Z"
              Fill="#F7FBFF"
              Stroke="#67B9D8"
              StrokeThickness="2"
              HorizontalAlignment="Right"
              VerticalAlignment="Bottom"
              Margin="0,0,36,-12" />
    </Grid>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)
$speakerText = $window.FindName('SpeakerText')
$quoteText = $window.FindName('QuoteText')
$speakerText.Text = [string]$config.speaker

$script:lastLineIndex = -1
$script:isPaused = $false

function Set-OverlayPosition {
    $workArea = [System.Windows.SystemParameters]::WorkArea
    if ([string]$config.position.horizontal -eq 'left') {
        $window.Left = $workArea.Left + [double]$config.position.offsetX
    } else {
        $window.Left = $workArea.Right - $window.Width - [double]$config.position.offsetX
    }

    if ([string]$config.position.vertical -eq 'top') {
        $window.Top = $workArea.Top + [double]$config.position.offsetY
    } else {
        $window.Top = $workArea.Bottom - $window.Height - [double]$config.position.offsetY
    }
}

function Get-NextLine {
    if ($config.lines.Count -eq 1) {
        $script:lastLineIndex = 0
        return [string]$config.lines[0]
    }

    do {
        $nextIndex = Get-Random -Minimum 0 -Maximum $config.lines.Count
    } while ($nextIndex -eq $script:lastLineIndex)

    $script:lastLineIndex = $nextIndex
    return [string]$config.lines[$nextIndex]
}

$hideTimer = New-Object Windows.Threading.DispatcherTimer
$hideTimer.Interval = [TimeSpan]::FromSeconds([double]$config.displaySeconds)
$hideTimer.Add_Tick({
    $hideTimer.Stop()
    $window.Hide()
})

function Show-NextDialogue {
    if ($script:isPaused) {
        return
    }
    Set-OverlayPosition
    $quoteText.Text = Get-NextLine
    $window.Opacity = 1
    $window.Show()
    $hideTimer.Stop()
    $hideTimer.Start()
}

$nextTimer = New-Object Windows.Threading.DispatcherTimer
$nextTimer.Add_Tick({
    $nextTimer.Stop()
    Show-NextDialogue
    $nextDelay = Get-Random `
        -Minimum ([int]$config.intervalMinSeconds) `
        -Maximum ([int]$config.intervalMaxSeconds + 1)
    $nextTimer.Interval = [TimeSpan]::FromSeconds($nextDelay)
    $nextTimer.Start()
})
$nextTimer.Interval = [TimeSpan]::FromSeconds([double]$config.startupDelaySeconds)

$window.Add_MouseLeftButtonUp({
    $hideTimer.Stop()
    $window.Hide()
})

$trayMenu = New-Object System.Windows.Forms.ContextMenuStrip
$nextItem = $trayMenu.Items.Add('Next line')
$pauseItem = $trayMenu.Items.Add('Pause')
$exitItem = $trayMenu.Items.Add('Exit')

$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Icon = [System.Drawing.SystemIcons]::Information
$trayIcon.Text = 'Amiya dialogue'
$trayIcon.ContextMenuStrip = $trayMenu
$trayIcon.Visible = $true

$nextItem.Add_Click({ Show-NextDialogue })
$pauseItem.Add_Click({
    $script:isPaused = -not $script:isPaused
    if ($script:isPaused) {
        $pauseItem.Text = 'Resume'
        $window.Hide()
        $hideTimer.Stop()
    } else {
        $pauseItem.Text = 'Pause'
        Show-NextDialogue
    }
})
$trayIcon.Add_DoubleClick({ Show-NextDialogue })
$exitItem.Add_Click({
    $window.Close()
    $application.Shutdown()
})

$window.Add_Closed({
    $nextTimer.Stop()
    $hideTimer.Stop()
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    $application.Shutdown()
})

$nextTimer.Start()
[void]$application.Run()
