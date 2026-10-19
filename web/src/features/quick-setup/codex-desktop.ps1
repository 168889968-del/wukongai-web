# Codex desktop deployment. Shared portable Node helpers are prepended by the BAT builder.
# This script never installs the Codex CLI or terminates a running desktop session.
function Get-CodexDesktop {
    Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop | Sort-Object { [version]$_.Version } -Descending | Select-Object -First 1
}

function Get-CodexMsixIdentity([string]$Path) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $archive.GetEntry('AppxManifest.xml')
        if (-not $entry) { throw 'The file is not a Codex MSIX package.' }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $identity = $manifest.Package.Identity
        if ($identity.Name -ne 'OpenAI.Codex' -or $identity.Publisher -ne 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B') {
            throw 'The installer is not the official OpenAI.Codex package.'
        }
        return $identity
    } finally { $archive.Dispose() }
}

function Save-CodexInstaller([string]$Url, [string]$Path) {
    Add-Type -AssemblyName System.Net.Http
    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMinutes(30)
    $response = $null
    $inputStream = $null
    $outputStream = $null
    $temporary = "$Path.partial"
    try {
        $response = $client.GetAsync($Url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        $response.EnsureSuccessStatusCode() | Out-Null
        $length = $response.Content.Headers.ContentLength
        $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $outputStream = [IO.File]::Create($temporary)
        $buffer = New-Object byte[] (1024 * 1024)
        $received = 0L
        $lastProgress = [datetime]::MinValue
        while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $outputStream.Write($buffer, 0, $count)
            $received += $count
            if (([datetime]::UtcNow - $lastProgress).TotalSeconds -ge 1) {
                $message = '已下载 {0:N0} MB' -f ($received / 1MB)
                if ($length -gt 0) { $message += ' / {0:N0} MB' -f ($length / 1MB) }
                Write-Host $message
                $lastProgress = [datetime]::UtcNow
            }
        }
        $outputStream.Dispose()
        $outputStream = $null
        if ($length -gt 0 -and $received -ne $length) { throw 'Installer download is incomplete. Run this BAT again.' }
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    } finally {
        if ($outputStream) { $outputStream.Dispose() }
        if ($inputStream) { $inputStream.Dispose() }
        if ($response) { $response.Dispose() }
        $client.Dispose()
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Install-WukongMsix([string]$Path) {
    try {
        Add-AppxPackage -Path $Path -ErrorAction Stop
        return
    } catch {
        # Packaged services require an elevated token, even for a per-user MSIX.
        $details = $_.ToString() + ' ' + $_.Exception.ToString()
        if ($details -notmatch '(?i)80073D28|80070005|-2147009240|-2147024891') { throw }
    }
    Write-Host '桌面安装需要管理员权限，请在 Windows 授权框中允许安装。安装后将返回当前账户继续配置。' -ForegroundColor Yellow
    $installerPath = [IO.Path]::GetFullPath($Path).Replace("'", "''")
    $expectedHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    $originalSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    # Elevate only fixed installation code, never the BAT or a writable helper file.
    # No payload, API key or configuration code is passed to the elevated process.
    $installScript = @"
`$ErrorActionPreference = 'Stop'
try {
    if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne '$originalSid') { exit 83 }
    if ((Get-FileHash -LiteralPath '$installerPath' -Algorithm SHA256).Hash -ne '$expectedHash') { exit 84 }
    Add-AppxPackage -Path '$installerPath' -ErrorAction Stop
    exit 0
} catch { Write-Host `$_ -ForegroundColor Red; Read-Host 'Press Enter to return'; exit 85 }
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($installScript))
    try {
        $process = Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -PassThru -Wait
    } catch {
        throw '管理员授权未完成，桌面客户端尚未安装。请重新运行 BAT，并允许 Windows 安装授权。'
    }
    if ($process.ExitCode -eq 83) { throw '不能使用另一个管理员账户安装到当前账户。请让管理员为当前用户安装此桌面客户端后，再运行 BAT 配置悟空Ai。未修改服务或密钥配置。' }
    if ($process.ExitCode -eq 84) { throw '安装包在授权期间发生变化，已停止安装。请重新下载安装包。' }
    if ($process.ExitCode -ne 0) { throw "管理员安装失败（退出码 $($process.ExitCode)），未继续配置。请保留安装窗口中的错误信息。" }
}

function Install-CodexDesktop([string]$InstallerDirectory) {
    $installed = Get-CodexDesktop
    if ($installed) {
        Write-Host "已安装官方桌面客户端，版本 $($installed.Version)，保留现有版本。" -ForegroundColor Green
        return $installed
    }
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $architecture = if ($architecture -eq 'ARM64') { 'arm64' } elseif ($architecture -eq 'AMD64') { 'x64' } else { throw 'Codex desktop requires 64-bit Windows (x64 or ARM64).' }
    $installer = $null
    foreach ($name in @('Codex-Windows安装包.Msix', "ChatGPT-$architecture.msix")) {
        $candidate = Join-Path $InstallerDirectory $name
        if (Test-Path -LiteralPath $candidate) {
            $identity = Get-CodexMsixIdentity $candidate
            if ($identity.ProcessorArchitecture -eq $architecture) { $installer = $candidate; break }
        }
    }
    if (-not $installer) {
        $cache = Join-Path $env:LOCALAPPDATA 'WukongAi\desktop-installers'
        New-Item -ItemType Directory -Path $cache -Force | Out-Null
        $installer = Join-Path $cache "ChatGPT-$architecture.msix"
        if (-not (Test-Path -LiteralPath $installer)) {
            Write-Host '正在下载 OpenAI 官方桌面安装包，文件较大，请保持此窗口打开。' -ForegroundColor Cyan
            Save-CodexInstaller "https://persistent.oaistatic.com/codex-app-prod/ChatGPT-$architecture.msix" $installer
        }
    }
    $identity = Get-CodexMsixIdentity $installer
    if ($identity.ProcessorArchitecture -ne $architecture) { throw 'The installer does not match this computer architecture.' }
    Write-Host "正在安装 Codex 桌面端 $($identity.Version)..." -ForegroundColor Cyan
    # Windows validates the package signature and dependencies. Never allow unsigned packages.
    Install-WukongMsix $installer
    $installed = Get-CodexDesktop
    if (-not $installed) { throw 'Windows did not register the Codex desktop application.' }
    return $installed
}

function New-WukongDesktopShortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$Description) {
    # IShellLinkW and IPersistFile keep Unicode paths intact on every Windows system locale.
    # WScript.Shell's shortcut writer loses Chinese filenames on English Windows.
    if (-not ('WukongDesktopShortcut' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
internal class WukongShellLink { }
[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IWukongShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max, IntPtr data, uint flags);
    void GetIDList(out IntPtr list);
    void SetIDList(IntPtr list);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int max);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string path);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int max);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string text);
    void GetHotkey(out short hotkey);
    void SetHotkey(short hotkey);
    void GetShowCmd(out int command);
    void SetShowCmd(int command);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max, out int index);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
    void Resolve(IntPtr window, uint flags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
}
public static class WukongDesktopShortcut {
    public static void Save(string path, string target, string arguments, string description) {
        IWukongShellLinkW link = (IWukongShellLinkW)new WukongShellLink();
        try {
            link.SetPath(target);
            link.SetArguments(arguments ?? "");
            link.SetDescription(description ?? "");
            ((IPersistFile)link).Save(path, true);
        } finally { Marshal.FinalReleaseComObject(link); }
    }
}
'@
    }
    $directory = Split-Path $Path
    if (-not $directory) { throw 'Windows did not provide a desktop shortcut directory.' }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    [WukongDesktopShortcut]::Save($Path, $Target, $Arguments, $Description)
}

function Open-CodexDesktop($Package, [string]$DesktopDirectory = [Environment]::GetFolderPath('Desktop')) {
    [xml]$manifest = Get-Content -LiteralPath (Join-Path $Package.InstallLocation 'AppxManifest.xml') -Raw
    $application = @($manifest.Package.Applications.Application)[0].Id
    if (-not $application) { throw 'The installed desktop application has no launch entry.' }
    $appId = "$($Package.PackageFamilyName)!$application"
    $target = Join-Path $env:WINDIR 'explorer.exe'
    $arguments = "shell:AppsFolder\$appId"
    New-WukongDesktopShortcut (Join-Path $DesktopDirectory 'Codex - 悟空Ai.lnk') $target $arguments '打开 Codex 官方桌面客户端'
    Start-Process -FilePath $target -ArgumentList $arguments
}

function Read-WukongApiKey {
    $secure = Read-Host '请粘贴悟空Ai API 密钥（输入不会显示）' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
    if (-not $value -or $value -match '[\s\x00-\x1f]') { throw 'API key is empty or contains whitespace. Copy one complete key and retry.' }
    return $value
}

function Get-WukongCodexModel([string]$Base, [string]$Key, [string]$SelectedModel = '') {
    $response = Invoke-RestMethod -Uri "$Base/v1/models" -Headers @{ Authorization = "Bearer $Key" } -TimeoutSec 30
    $models = @($response.data | ForEach-Object { $_.id } | Where-Object { $_ -match '^(gpt-|o[1-9]|codex)' })
    if (-not $models.Count) { throw 'This API key has no GPT/Codex models. Check the key permissions in the WukongAi console.' }
    if ($SelectedModel) {
        if ($SelectedModel -notin @($response.data | ForEach-Object { $_.id })) { throw 'The selected model is not available to this API key.' }
        return $SelectedModel
    }
    # Prefer the model used by the supplied reference when it is available to this key.
    if ($models -contains 'gpt-6.1-sol') { return 'gpt-6.1-sol' }
    return ($models | Sort-Object -Descending | Select-Object -First 1)
}

function Set-CodexDesktopConfiguration($InputConfig, [string]$CodexRoot) {
    $node = Get-Node
    $env:Path = (Split-Path $node) + ';' + $env:Path
    $npm = Join-Path (Split-Path $node) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) { $npm = (Get-Command npm.cmd -ErrorAction Stop).Source }
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $tools 'node_modules\@iarna\toml\package.json')) -or -not (Test-Path -LiteralPath (Join-Path $tools 'node_modules\yaml\package.json'))) {
        & $npm install --prefix $tools --no-audit --no-fund --registry=https://registry.npmjs.org yaml@2 @iarna/toml@2
        if ($LASTEXITCODE -ne 0) { throw 'Unable to prepare the configuration parser.' }
    }
    $backupName = if ($InputConfig.desktop) { '.wukongai-desktop-backup' } else { '.wukongai-setup-backup' }
    $backup = Join-Path $CodexRoot $backupName
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $acl = [IO.Directory]::GetAccessControl($backup, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    [IO.Directory]::SetAccessControl($backup, $acl)
    $worker = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($wukongWorkerEncoded))
    $workerPath = Join-Path $tools 'wukongai-codex-desktop-worker.mjs'
    [IO.File]::WriteAllText($workerPath, $worker, [Text.UTF8Encoding]::new($false))
    $InputConfig | ConvertTo-Json -Compress | & $node $workerPath wukongai-config $CodexRoot $tools
    if ($LASTEXITCODE -ne 0) { throw 'Unable to update Codex configuration. The original backup was preserved.' }
    foreach ($name in @('auth.json', 'config.toml')) {
        $file = Join-Path $CodexRoot $name
        if (Test-Path -LiteralPath $file) {
            $fileAcl = [IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access)
            $fileAcl.SetAccessRuleProtection($true, $false)
            $fileAcl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
            [IO.File]::SetAccessControl($file, $fileAcl)
        }
    }
}

# WUKONGAI_DESKTOP_MAIN
try {
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')) | ConvertFrom-Json
    $wukongWorkerEncoded = '__WORKER__'
    Write-Host '悟空Ai - Codex 官方桌面端一键部署' -ForegroundColor Cyan
    Write-Host '此工具安装桌面应用；默认服务为 https://wukongai.work。密钥仅保存在本机。'
    $root = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
    $root = [IO.Path]::GetFullPath($root)
    $mode = $payload.mode
    if ($mode -eq 'install') {
        Write-Host ''
        Write-Host '1. 使用默认服务：悟空Ai（推荐，安装后输入 API 密钥）'
        Write-Host '2. 仅安装桌面端，保留现有服务配置'
        Write-Host '3. 恢复本工具接入悟空Ai前保存的配置'
        $choice = Read-Host '请选择 [1/2/3]，直接回车使用悟空Ai'
        if (-not $choice) { $choice = '1' }
        if ($choice -notin @('1', '2', '3')) { throw 'Choose 1, 2 or 3 and run the BAT again.' }
        if ($choice -eq '3') { $mode = 'restore' }
    }
    if ($mode -ne 'restore') {
        $stage = '安装官方桌面客户端'
        $directory = if ($env:WUKONGAI_SETUP_FILE) { Split-Path $env:WUKONGAI_SETUP_FILE } else { (Get-Location).Path }
        $package = Install-CodexDesktop $directory
    }
    if ($mode -eq 'install' -and $choice -eq '2') {
        Open-CodexDesktop $package
        Write-Host '桌面客户端已安装并打开，现有服务配置未更改。' -ForegroundColor Green
        exit 0
    }
    if ($mode -eq 'restore') {
        if (-not (Test-Path -LiteralPath (Join-Path $root '.wukongai-setup-backup\state.json'))) {
            Write-Host '没有找到本工具的原配置备份，未修改任何配置。' -ForegroundColor Yellow
            exit 0
        }
        $configuration = @{ client = 'codex'; mode = 'restore' }
    } else {
        $stage = '验证悟空Ai密钥和模型'
        $base = 'https://wukongai.work'
        $key = if ($mode -eq 'setup') { $payload.key } else { Read-WukongApiKey }
        if ($mode -eq 'setup') { $base = $payload.base.TrimEnd('/') }
        $selected = if ($mode -eq 'setup') { $payload.model } else { '' }
        $model = Get-WukongCodexModel $base $key $selected
        Write-Host "默认服务：悟空Ai；模型：$model"
        $configuration = @{ client = 'codex'; mode = 'setup'; base = $base; key = $key; model = $model }
    }
    $stage = '备份并配置桌面客户端'
    Set-CodexDesktopConfiguration $configuration $root
    $configuration = $null
    $key = $null
    if ($mode -eq 'restore') {
        Write-Host '已恢复原配置。请自行关闭并重新打开桌面客户端。' -ForegroundColor Green
    } else {
        $stage = '创建桌面快捷方式并打开客户端'
        Open-CodexDesktop $package
        Write-Host '部署完成：桌面已有“Codex - 悟空Ai”快捷方式。若客户端之前已打开，请保存工作后自行重启，让新配置生效。' -ForegroundColor Green
    }
    exit 0
} catch {
    Write-Host "执行未完成：$stage。" -ForegroundColor Red
    $message = $_.Exception.Message
    if ($key) { $message = $message.Replace($key, '[API key]') }
    if ($payload.key) { $message = $message.Replace($payload.key, '[API key]') }
    Write-Host $message -ForegroundColor Yellow
    Write-Host '请保留此窗口中的错误信息；工具没有关闭你的客户端或删除原配置。'
    exit 1
}
