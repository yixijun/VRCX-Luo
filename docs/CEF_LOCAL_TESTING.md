# Windows CEF 本地测试与安全重启

本文记录 VRCX-Luo Windows CEF 版本的进程模型、本地构建、安全重启和关闭到托盘行为。

## CEF 进程模型

CEF 主窗口和浏览器子进程都使用同一个可执行文件：

```text
build/Cef/VRCX-Luo.exe
```

不能只根据进程名区分主进程和子进程：

- 主进程的命令行不包含 `--type=`；
- renderer、GPU 等 CEF 子进程的命令行包含 `--type=renderer`、
  `--type=gpu-process` 等参数。

CEF 初始化时设置了 `SubprocessExitIfParentProcessClosed`，主进程结束后，子进程会自行退出。

## 禁止批量强杀

不要使用以下命令重启测试版：

```powershell
taskkill /F /IM VRCX-Luo.exe /T
Get-Process -Name 'VRCX-Luo' | Stop-Process -Force
```

这些命令会把主进程和 CEF 子进程一起强制结束。CEF 子进程被单独强杀时，Windows 可能弹出
`0xe0434352` 托管异常窗口。该窗口不一定表示 VRCX 主进程发生了未处理异常，VRCX 日志和
Windows 的 `.NET Runtime` 事件中也可能没有对应记录。

## 安全停止

优先通过托盘菜单的“退出 VRCX-Luo”正常退出。需要自动停止本地测试版时，只结束不包含
`--type=` 的主进程，然后等待子进程自然退出：

```powershell
$exe = (Resolve-Path '.\build\Cef\VRCX-Luo.exe').Path
$mainProcesses = Get-CimInstance Win32_Process -Filter "Name = 'VRCX-Luo.exe'" |
    Where-Object {
        $_.ExecutablePath -eq $exe -and
        $_.CommandLine -notmatch '--type='
    }

$mainProcesses | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
}

$deadline = (Get-Date).AddSeconds(10)
do {
    Start-Sleep -Milliseconds 250
    $remaining = Get-CimInstance Win32_Process -Filter "Name = 'VRCX-Luo.exe'" |
        Where-Object { $_.ExecutablePath -eq $exe }
} while ($remaining -and (Get-Date) -lt $deadline)

if ($remaining) {
    throw "CEF processes did not exit: $($remaining.ProcessId -join ', ')"
}
```

不要在等待失败后直接批量强杀子进程，应先检查主进程、父进程 ID 和命令行。

## 构建与启动

也可以运行 `build-windows-local.bat` 完成前后端构建；该脚本使用上面的安全停止流程，不会
按进程名批量强杀 CEF 子进程。

修改前端源码后，先构建 `build/html`：

```powershell
npm run prod
```

构建 Windows CEF Release：

```powershell
dotnet build Dotnet/VRCX-Cef.csproj --no-restore `
    -p:Configuration=Release `
    -p:Platform=x64 `
    --self-contained
```

### 出现“.NET 需要安装或更新”窗口

如果启动 `VRCX-Luo.exe` 时出现下面的系统窗口：

```text
You must install or update .NET to run this application.
```

这不是 VRCX 页面或云同步代码抛出的异常，而是 Windows CEF 可执行文件在应用代码启动前
没有找到所需运行时。常见原因是手动构建时漏掉了 `--self-contained`，生成了依赖本机 .NET
运行时的 framework-dependent 可执行文件。

本地测试版按仓库的自包含方式重新构建即可，不需要用户另外安装 .NET Desktop Runtime：

```powershell
dotnet build Dotnet/VRCX-Cef.csproj `
    -p:Configuration=Release `
    -p:WarningLevel=0 `
    -p:Platform=x64 `
    -p:PlatformTarget=x64 `
    -p:RestorePackagesConfig=true `
    -t:"Restore;Clean;Build" `
    -m -a x64 `
    --self-contained
```

也可以直接运行根目录的 `build-windows-local.bat`，不要用不带 `--self-contained` 的旧命令
覆盖 `build/Cef`。构建完成后检查输出目录中存在 `coreclr.dll` 和 `hostfxr.dll`，再启动：

```powershell
Test-Path '.\build\Cef\coreclr.dll'
Test-Path '.\build\Cef\hostfxr.dll'
Start-Process -FilePath '.\build\Cef\VRCX-Luo.exe' -WorkingDirectory '.\build\Cef'
```

如果必须使用 framework-dependent 构建，则需要安装与项目目标框架和架构匹配的
`.NET 10 Windows Desktop Runtime x64`；但这不是本地便携测试版的推荐方案。修复后应看到
VRCX 主窗口标题并能在 `%APPDATA%\VRCX\logs` 中生成新的启动日志，而不是 .NET 安装提示。

本地脚本会把 `build/Cef/Version` 标记为 `Nightly Build`，因此测试版窗口标题显示为
`VRCX-Luo Nightly Build`。仓库根目录的 `Version` 不会被修改，正式构建仍使用正式版本号。

启动测试版：

```powershell
Start-Process -FilePath '.\build\Cef\VRCX-Luo.exe' -WorkingDirectory '.\build\Cef'
```

启动后应确认主进程不带 `--type=`、`Responding` 为 `True`，且可见状态下
`MainWindowHandle` 不为 `0`。

## 关闭到托盘

相关配置保存在 `%APPDATA%\VRCX\VRCX.json`：

- `VRCX_CloseToTray=true`：点击主窗口关闭按钮时直接隐藏到托盘；
- `VRCX_CloseToTrayPrompt=false`：不再显示关闭行为询问框；
- 询问框的 `×`、`Esc` 或“取消”只取消本次关闭，不退出应用，也不保存偏好。

隐藏到托盘后，进程仍在运行，但 `Get-Process` 显示的 `MainWindowHandle` 可能为 `0`。可通过
托盘左键、托盘菜单“打开 VRCX-Luo”，或再次启动同一程序并由单实例 IPC 唤回窗口。

## 排查退出或异常弹窗

按以下顺序检查：

1. 检查是否仍有不带 `--type=` 的主进程；存在则应用可能只是隐藏到托盘。
2. 查看 `%APPDATA%\VRCX\logs` 下最新的 `VRCX*.log`。
3. 查看 Windows 应用程序事件中的 `.NET Runtime`、`Application Error` 和
   `Windows Error Reporting`。
4. 记录异常发生前执行的重启命令，确认是否批量强杀了同名 CEF 子进程。
5. 将 VRChat API 的 SSL EOF 与进程崩溃分开处理；SSL EOF 是网络请求错误，本身不表示
   WinForms 主进程崩溃。

关闭行为的回归测试：

```powershell
dotnet run --project Dotnet.Tests/VRCX.Cef.Tests.csproj
```
