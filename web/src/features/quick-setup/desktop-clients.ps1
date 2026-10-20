# Graphical desktop installers for Claude, DeepSeek Harness and Grok Build Desktop.
# Common download/bootstrap/configuration functions are prepended by the BAT builder.
function Get-DesktopArchitecture {
    $value = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($value -eq 'AMD64') { return 'x64' }
    if ($value -eq 'ARM64') { return 'arm64' }
    throw 'A 64-bit Windows computer is required.'
}

function Get-VerifiedDesktopInstaller([string]$Client) {
    $architecture = Get-DesktopArchitecture
    $release = $desktopReleases.$Client
    $asset = $release.$architecture
    if (-not $asset) { throw "No verified $architecture desktop installer is available for $Client. No terminal-only substitute was installed." }
    $cache = Join-Path $env:LOCALAPPDATA 'WukongAi\desktop-installers'
    New-Item -ItemType Directory -Path $cache -Force | Out-Null
    $extension = [IO.Path]::GetExtension(([uri]$asset.url).AbsolutePath)
    $installer = Join-Path $cache "$Client-$($release.version)-$architecture$extension"
    if (-not (Test-Path -LiteralPath $installer)) {
        Write-Host "正在下载 $Client 桌面安装包，请保持此窗口打开。" -ForegroundColor Cyan
        Save-CodexInstaller $asset.url $installer
    }
    if ($asset.sha256) {
        $actual = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
        if ($actual -ne $asset.sha256) { throw 'Desktop installer SHA-256 mismatch. The file was not executed.' }
    } else {
        $hash = [Security.Cryptography.SHA512]::Create()
        $stream = [IO.File]::OpenRead($installer)
        try { $actual = [Convert]::ToBase64String($hash.ComputeHash($stream)) }
        finally { $stream.Dispose(); $hash.Dispose() }
        if ($actual -ne $asset.sha512) { throw 'Desktop installer SHA-512 mismatch. The file was not executed.' }
    }
    return $installer
}

function Install-GraphicalDesktop([string]$Client) {
    if ($Client -eq 'claude') {
        $package = Get-AppxPackage -Name 'Claude' -ErrorAction Stop | Where-Object { $_.PackageFamilyName -eq 'Claude_pzs8sxrjxfjjc' } | Select-Object -First 1
        if (-not $package) {
            $installer = Get-VerifiedDesktopInstaller $Client
            Install-WukongMsix $installer
            $package = Get-AppxPackage -Name 'Claude' -ErrorAction Stop | Where-Object { $_.PackageFamilyName -eq 'Claude_pzs8sxrjxfjjc' } | Select-Object -First 1
        }
        if (-not $package) { throw 'Windows did not register the official Claude desktop app.' }
        [xml]$manifest = Get-Content -LiteralPath (Join-Path $package.InstallLocation 'AppxManifest.xml') -Raw
        $appId = @($manifest.Package.Applications.Application)[0].Id
        if (-not $appId) { throw 'Claude desktop has no launch entry.' }
        return @{ target = (Join-Path $env:WINDIR 'explorer.exe'); arguments = "shell:AppsFolder\$($package.PackageFamilyName)!$appId" }
    }
    $product = if ($Client -eq 'grok') { 'Grok Build Desktop' } else { 'DeepSeek Harness' }
    $destination = Join-Path $env:LOCALAPPDATA "Programs\WukongAi-$Client"
    $executable = Join-Path $destination "$product.exe"
    if (-not (Test-Path -LiteralPath $executable)) {
        $installer = Get-VerifiedDesktopInstaller $Client
        # NSIS's /D consumes the remaining command line, including spaces in the user's path.
        $process = Start-Process -FilePath $installer -ArgumentList "/S /D=$destination" -PassThru -Wait -WindowStyle Hidden
        if ($process.ExitCode -ne 0) { throw "Desktop installer failed with exit code $($process.ExitCode)." }
    }
    if (-not (Test-Path -LiteralPath $executable)) { throw "The $product graphical executable was not installed." }
    return @{ target = $executable; arguments = '' }
}

function Protect-DesktopConfigFile([string]$Path) {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [IO.File]::GetAccessControl($Path, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
    [IO.File]::SetAccessControl($Path, $acl)
}

function Set-ClaudeDesktopGatewayCore($Configuration, [string]$BackupDirectory, [string]$PolicyPath = 'SOFTWARE\Policies\Claude') {
    $machine = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($PolicyPath)
    if ($machine) {
        try { if ($machine.GetValueNames().Count -gt 0) { throw 'Claude has machine-wide policy. Ask its administrator to configure the gateway; user policy would be ignored.' } }
        finally { $machine.Dispose() }
    }
    $names = @('inferenceProvider', 'inferenceCredentialKind', 'inferenceGatewayBaseUrl', 'inferenceGatewayApiKey', 'inferenceGatewayAuthScheme', 'inferenceModels', 'deploymentDisplayName')
    $snapshot = Join-Path $BackupDirectory 'registry.json'
    if ($Configuration.mode -eq 'restore' -and -not (Test-Path -LiteralPath $snapshot)) {
        Write-Host '没有找到桌面端原配置备份，未修改任何配置。' -ForegroundColor Yellow
        return
    }
    $registry = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($PolicyPath)
    $writesStarted = $false
    try {
        if ($Configuration.mode -ne 'restore' -and $registry.GetValue('bootstrapUrl')) {
            throw 'Claude is managed by a bootstrap server. Its administrator must change the gateway; user settings would be ignored.'
        }
        if ($Configuration.mode -eq 'restore') {
            $state = Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json
            if (-not $state.active) { return }
            $writesStarted = $true
            foreach ($entry in $state.values) {
                if ($entry.exists) { $registry.SetValue($entry.name, $entry.value, [Microsoft.Win32.RegistryValueKind]$entry.kind) }
                else { $registry.DeleteValue($entry.name, $false) }
            }
            $state.active = $false
            [IO.File]::WriteAllText($snapshot, ($state | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
            return
        }
        $state = if (Test-Path -LiteralPath $snapshot) { Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json } else { $null }
        if (-not $state -or -not $state.active) {
            $values = foreach ($name in $names) {
                $exists = $registry.GetValueNames() -contains $name
                @{name=$name; exists=$exists; value= $(if ($exists) { $registry.GetValue($name) } else { $null }); kind= $(if ($exists) { [string]$registry.GetValueKind($name) } else { 'String' })}
            }
            New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            [IO.File]::WriteAllText($snapshot, (@{active=$true;values=@($values)} | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
            Protect-DesktopConfigFile $snapshot
        }
        $values = @{
            inferenceProvider = 'gateway'
            inferenceCredentialKind = 'static'
            inferenceGatewayBaseUrl = $Configuration.base
            inferenceGatewayApiKey = $Configuration.key
            inferenceGatewayAuthScheme = 'bearer'
            inferenceModels = (ConvertTo-Json -InputObject @(@{name=$Configuration.model}) -Compress)
            deploymentDisplayName = '悟空Ai'
        }
        $writesStarted = $true
        foreach ($name in $names) { $registry.SetValue($name, [string]$values[$name], [Microsoft.Win32.RegistryValueKind]::String) }
    } catch {
        # Restore just the fields managed by this tool; preserve unrelated user policy.
        if ($writesStarted -and (Test-Path -LiteralPath $snapshot)) {
            $state = Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json
            foreach ($entry in $state.values) {
                if ($entry.exists) { $registry.SetValue($entry.name, $entry.value, [Microsoft.Win32.RegistryValueKind]$entry.kind) }
                else { $registry.DeleteValue($entry.name, $false) }
            }
        }
        throw
    } finally { $registry.Dispose() }
}

function Invoke-ClaudePolicyElevation($Configuration, [string]$BackupDirectory, [string]$PolicyPath) {
    Write-Host 'Windows 保护 Claude 策略配置，需要再次管理员授权。请允许写入当前账户的悟空Ai配置。' -ForegroundColor Yellow
    Add-Type -AssemblyName System.Security
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('wukongai-policy-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $directory -ErrorAction Stop | Out-Null
    $requestPath = Join-Path $directory 'request.bin'
    try {
        $acl = [IO.Directory]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Access)
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
        [IO.Directory]::SetAccessControl($directory, $acl)
        $json = @{configuration=$Configuration} | ConvertTo-Json -Depth 8 -Compress
        $encrypted = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($json), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes($requestPath, $encrypted)
        $json = $null
        $literalPath = $requestPath.Replace("'", "''")
        $literalBackup = [IO.Path]::GetFullPath($BackupDirectory).Replace("'", "''")
        $literalPolicy = $PolicyPath.Replace("'", "''")
        # Fixed function bodies are embedded, rather than executing a writable script.
        # The command line contains only a DPAPI-encrypted request's path and the SID.
        $definitions = "function Protect-DesktopConfigFile {`n$(${function:Protect-DesktopConfigFile}.ToString())`n}`nfunction Set-ClaudeDesktopGatewayCore {`n$(${function:Set-ClaudeDesktopGatewayCore}.ToString())`n}"
        $helper = @"
`$ErrorActionPreference = 'Stop'
`$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Security
$definitions
try {
    if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne '$($sid.Value)') { exit 83 }
    `$bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes('$literalPath'), `$null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    `$request = [Text.Encoding]::UTF8.GetString(`$bytes) | ConvertFrom-Json
    Set-ClaudeDesktopGatewayCore `$request.configuration '$literalBackup' '$literalPolicy'
    exit 0
} catch {
    `$message = `$_.Exception.Message
    if (`$request.configuration.key) { `$message = `$message.Replace(`$request.configuration.key, '[API key]') }
    Write-Host `$message -ForegroundColor Red
    Read-Host 'Press Enter to return'
    exit 85
}
"@
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($helper))
        try {
            $process = Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -PassThru -Wait
        } catch { throw 'Claude 配置授权未完成。请重新运行 BAT 并允许 Windows 配置授权；桌面客户端无需重新下载安装。' }
        if ($process.ExitCode -eq 83) { throw '配置授权使用了另一个管理员账户，已停止。请由管理员协助为当前账户配置 Claude；未将密钥写入其他账户。' }
        if ($process.ExitCode -ne 0) { throw "Claude 管理员配置失败（退出码 $($process.ExitCode)）。请保留授权窗口中的错误信息；原配置备份未删除。" }
    } finally {
        if (Test-Path -LiteralPath $requestPath) { Remove-Item -LiteralPath $requestPath -Force -ErrorAction SilentlyContinue }
        Remove-Item -LiteralPath $directory -ErrorAction SilentlyContinue
    }
}

function Set-ClaudeDesktopGateway($Configuration, [string]$BackupDirectory, [string]$PolicyPath = 'SOFTWARE\Policies\Claude') {
    try { Set-ClaudeDesktopGatewayCore $Configuration $BackupDirectory $PolicyPath }
    catch {
        $exception = $_.Exception
        $denied = $false
        while ($exception) {
            if ($exception -is [UnauthorizedAccessException] -or $exception -is [Security.SecurityException]) { $denied = $true; break }
            $exception = $exception.InnerException
        }
        if (-not $denied) { throw }
        Invoke-ClaudePolicyElevation $Configuration $BackupDirectory $PolicyPath
    }
}

function Get-WukongDesktopModel([string]$Client, [string]$Base, [string]$Key, [string]$SelectedModel) {
    if ($Client -eq 'claude' -and $SelectedModel -and $SelectedModel -notmatch '(^|[/.])(claude[-.]|anthropic[/.])') {
        throw 'Claude 桌面版不支持 GPT、Grok 或 DeepSeek 模型。请在网站选择 Claude 模型；如需使用 GPT，请选择 ChatGPT / Codex 客户端。尚未写入配置。'
    }
    $response = Invoke-RestMethod -Uri "$Base/v1/models" -Headers @{ Authorization = "Bearer $Key" } -TimeoutSec 30
    $pattern = @{claude='(^|[/.])(claude[-.]|anthropic[/.])';grok='grok';deepseek='deepseek'}[$Client]
    $models = @($response.data | ForEach-Object { $_.id } | Where-Object { $_ -match $pattern })
    if ($SelectedModel) {
        if ($SelectedModel -notin @($response.data | ForEach-Object { $_.id })) { throw 'The selected model is not available to this API key.' }
        return $SelectedModel
    }
    if (-not $models.Count) { throw "This API key has no $Client models. Check model permissions in the WukongAi console." }
    return ($models | Sort-Object -Descending | Select-Object -First 1)
}

function Open-GraphicalDesktop([string]$Client, $Launch, [string]$ConfigRoot) {
    if ($Client -eq 'grok' -and (Test-Path -LiteralPath (Join-Path $ConfigRoot 'desktop-config.json'))) {
        $config = Join-Path $ConfigRoot 'desktop-config.json'
        $Launch.arguments = "-- --config-json=`"$config`""
    }
    $name = @{claude='Claude - 悟空Ai';deepseek='DeepSeek Harness - 悟空Ai';grok='Grok Build Desktop - 悟空Ai（社区版）'}[$Client]
    $path = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
    New-WukongDesktopShortcut $path $Launch.target $Launch.arguments $name
    if ($Launch.arguments) { Start-Process -FilePath $Launch.target -ArgumentList $Launch.arguments }
    else { Start-Process -FilePath $Launch.target }
}

# WUKONGAI_GRAPHICAL_MAIN
try {
    Assert-WukongWindowsVersion
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')) | ConvertFrom-Json
    $wukongWorkerEncoded = '__WORKER__'
    $desktopReleases = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__RELEASES__')) | ConvertFrom-Json
    $client = $payload.client
    if ($client -notin @('claude', 'grok', 'deepseek')) { throw 'Unknown desktop client.' }
    if ($client -eq 'claude' -and $payload.mode -eq 'setup' -and $payload.model -notmatch '(^|[/.])(claude[-.]|anthropic[/.])') {
        throw 'Claude 桌面版只接受 Claude 模型。如需 GPT，请回到网站选择 ChatGPT / Codex，并重新下载配置工具。尚未安装或修改配置。'
    }
    $names = @{claude='Claude 官方桌面版';deepseek='DeepSeek Harness 官方桌面版';grok='Grok Build Desktop 开源社区桌面版'}
    Write-Host "悟空Ai - $($names[$client]) 一键部署" -ForegroundColor Cyan
    Write-Host '默认服务：https://wukongai.work。输入的 API 密钥仅保存在本机。'
    if ($client -eq 'grok') { Write-Host 'Grok 桌面界面由 phuryn/grok-build-vscode 社区项目提供，不是 xAI 官方客户端。' -ForegroundColor Yellow }
    $homes = @{claude='.claude';grok='.grok';deepseek='.dsh'}
    $variables = @{claude='CLAUDE_CONFIG_DIR';grok='GROK_HOME';deepseek='DSH_HOME'}
    $root = [Environment]::GetEnvironmentVariable($variables[$client])
    if (-not $root) { $root = Join-Path $env:USERPROFILE $homes[$client] }
    $root = [IO.Path]::GetFullPath($root)
    $backup = Join-Path $root '.wukongai-desktop-backup'
    $mode = $payload.mode
    if ($mode -eq 'install') {
        Write-Host '1. 使用默认服务：悟空Ai（推荐，安装后输入 API 密钥）'
        Write-Host '2. 仅安装桌面端，保留现有服务配置'
        Write-Host '3. 恢复本工具接入悟空Ai前保存的配置'
        $choice = Read-Host '请选择 [1/2/3]，直接回车使用悟空Ai'
        if (-not $choice) { $choice = '1' }
        if ($choice -notin @('1', '2', '3')) { throw 'Choose 1, 2 or 3 and run the BAT again.' }
        if ($choice -eq '3') { $mode = 'restore' }
    }
    if ($mode -eq 'restore') {
        if (-not (Test-Path -LiteralPath $backup)) {
            if (Test-Path -LiteralPath (Join-Path $root '.wukongai-setup-backup\state.json')) {
                Set-CodexDesktopConfiguration @{client=$client;mode='restore'} $root
                Write-Host '已恢复旧版工具保存的原配置。请重新打开客户端。' -ForegroundColor Green
                exit 0
            }
            Write-Host '没有找到桌面端原配置备份，未修改任何配置。' -ForegroundColor Yellow
            exit 0
        }
        $configuration = @{client=$client;mode='restore';desktop=$true}
    } else {
        $stage = '安装桌面应用'
        $launch = Install-GraphicalDesktop $client
        if ($mode -eq 'install' -and $choice -eq '2') {
            Open-GraphicalDesktop $client $launch $root
            Write-Host '桌面客户端已安装并打开，现有服务配置未更改。' -ForegroundColor Green
            exit 0
        }
        $stage = '验证悟空Ai密钥和模型'
        $base = if ($mode -eq 'setup') { $payload.base.TrimEnd('/') } else { 'https://wukongai.work' }
        $key = if ($mode -eq 'setup') { $payload.key } else { Read-WukongApiKey }
        $selected = if ($mode -eq 'setup') { $payload.model } else { '' }
        $model = Get-WukongDesktopModel $client $base $key $selected
        Write-Host "默认服务：悟空Ai；模型：$model"
        $configuration = @{client=$client;mode='setup';desktop=$true;base=$base;key=$key;model=$model}
        if ($client -eq 'grok') {
            $stage = '安装桌面应用需要的 Grok 引擎'
            $env:Path = (Join-Path $env:USERPROFILE '.grok\bin') + ';' + $env:Path
            if (-not (Get-Command grok -ErrorAction SilentlyContinue)) { Invoke-NativeInstaller 'https://x.ai/cli/install.ps1' }
            $command = Get-Command grok -ErrorAction Stop
            $configuration.desktopCli = $command.Source
        }
    }
    $stage = '备份并配置桌面客户端'
    if ($client -eq 'claude') { Set-ClaudeDesktopGateway $configuration $backup }
    else {
        Set-CodexDesktopConfiguration $configuration $root
        foreach ($relative in @('config.toml', '.credentials.yaml', 'profiles\desktop\cordis.patch.yml')) {
            $file = Join-Path $root $relative
            if (Test-Path -LiteralPath $file) { Protect-DesktopConfigFile $file }
        }
    }
    $key = $null
    $configuration = $null
    if ($mode -eq 'restore') { Write-Host '已恢复桌面端原配置。请保存工作后重新打开客户端。' -ForegroundColor Green }
    else {
        $stage = '创建桌面快捷方式并打开客户端'
        Open-GraphicalDesktop $client $launch $root
        Write-Host '桌面端部署完成。以后可从桌面快捷方式打开；若此前已经打开，请保存工作后自行重启使新配置生效。' -ForegroundColor Green
    }
    exit 0
} catch {
    Write-Host "执行未完成：$stage。" -ForegroundColor Red
    $message = $_.Exception.Message
    if ($key) { $message = $message.Replace($key, '[API key]') }
    if ($payload.key) { $message = $message.Replace($payload.key, '[API key]') }
    Write-Host $message -ForegroundColor Yellow
    Write-Host '请保留错误信息；工具没有关闭正在使用的客户端。'
    exit 1
}
