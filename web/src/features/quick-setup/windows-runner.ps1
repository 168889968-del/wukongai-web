$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$stage = '初始化'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$tools = Join-Path $env:LOCALAPPDATA 'WukongAi\setup-runtime'

# Save the response bytes to a file: PS 5.1 returns byte[] for octet-stream.
# Passing .Content to ScriptBlock.Create converts it to decimal numbers.
function Invoke-NativeInstaller([string]$Url) {
    $installer = Join-Path ([IO.Path]::GetTempPath()) ('wukongai-installer-' + [guid]::NewGuid().ToString('N') + '.ps1')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $installer -TimeoutSec 120
        # Windows PowerShell 5.1 needs a BOM to reliably read UTF-8 scripts.
        $source = [IO.File]::ReadAllText($installer)
        [IO.File]::WriteAllText($installer, $source, [Text.UTF8Encoding]::new($true))
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
        if ($LASTEXITCODE -ne 0) { throw "Native client installation failed (exit $LASTEXITCODE)" }
    } finally {
        if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
    }
}

function Get-Node {
    $candidate = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($candidate) {
        $version = & $candidate.Source -p 'process.versions.node'
        if ([version]$version -ge [version]'22.19.0') { return $candidate.Source }
    }
    $existing = Get-ChildItem -LiteralPath $tools -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existing) { return $existing.FullName }
    Write-Host '正在安装配置所需的 Node.js 运行环境，请稍候...' -ForegroundColor Cyan
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $release = $releases | Where-Object { $_.lts -and ([version]$_.version.TrimStart('v')).Major -ge 24 -and $_.files -contains "win-$arch-zip" } | Select-Object -First 1
    if (-not $release) { throw 'Node release not available' }
    $name = "node-$($release.version)-win-$arch.zip"
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('wukongai-node-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary -Force | Out-Null
    try {
        $archive = Join-Path $temporary $name
        Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/$name" -OutFile $archive -UseBasicParsing
        $checksumFile = Join-Path $temporary 'SHASUMS256.txt'
        Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/SHASUMS256.txt" -UseBasicParsing -OutFile $checksumFile
        $checksums = [IO.File]::ReadAllText($checksumFile)
        $line = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith(" $name") })
        if (-not $line -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne ($line.Trim() -split '\s+')[0]) { throw 'Node checksum mismatch' }
        New-Item -ItemType Directory -Path $tools -Force | Out-Null
        Expand-Archive -LiteralPath $archive -DestinationPath $tools -Force
    } finally { Remove-Item -LiteralPath $temporary -Recurse -Force }
    return (Join-Path $tools "node-$($release.version)-win-$arch\node.exe")
}

try {
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')) | ConvertFrom-Json
    $names = @{ codex = 'Codex'; claude = 'Claude Code'; grok = 'Grok Build'; deepseek = 'DeepSeek Harness' }
    $homes = @{ codex = '.codex'; claude = '.claude'; grok = '.grok'; deepseek = '.dsh' }
    $homeVariables = @{ codex = 'CODEX_HOME'; claude = 'CLAUDE_CONFIG_DIR'; grok = 'GROK_HOME'; deepseek = 'DSH_HOME' }
    if (-not $names.ContainsKey($payload.client)) { throw 'Unknown client' }
    $root = [Environment]::GetEnvironmentVariable($homeVariables[$payload.client])
    if (-not $root) { $root = Join-Path $env:USERPROFILE $homes[$payload.client] }
    $root = [IO.Path]::GetFullPath($root)
    $action = if ($payload.mode -eq 'restore') { '切回官方版' } else { '一键配置' }
    Write-Host "悟空Ai - $($names[$payload.client]) $action" -ForegroundColor Cyan
    Write-Host '--------------------------------------------------'
    if ($payload.mode -eq 'restore' -and -not (Test-Path -LiteralPath (Join-Path $root '.wukongai-setup-backup\state.json'))) {
        Write-Host '没有找到本工具保存的备份，未修改任何配置。' -ForegroundColor Yellow
        exit 0
    }
    $stage = '准备运行环境'
    $node = Get-Node
    $env:Path = (Split-Path $node) + ';' + $env:Path
    $env:Path = (Join-Path $tools 'node_modules\.bin') + ';' + (Join-Path $env:USERPROFILE '.local\bin') + ';' + (Join-Path $env:USERPROFILE '.grok\bin') + ';' + $env:Path
    $npm = Join-Path (Split-Path $node) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) { $npm = (Get-Command npm.cmd -ErrorAction Stop).Source }
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    $stage = '准备配置组件'
    if (-not (Test-Path -LiteralPath (Join-Path $tools 'node_modules\@iarna\toml\package.json')) -or -not (Test-Path -LiteralPath (Join-Path $tools 'node_modules\yaml\package.json'))) {
        Write-Host '正在准备配置组件...' -ForegroundColor Cyan
        & $npm install --prefix $tools --no-audit --no-fund --registry=https://registry.npmjs.org yaml@2 @iarna/toml@2
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
    }
    if ($payload.mode -eq 'setup' -or $payload.mode -eq 'install') {
        $stage = '安装客户端'
        $commands = @{ codex = 'codex'; claude = 'claude'; grok = 'grok'; deepseek = 'dsh' }
        $clientCommand = Get-Command $commands[$payload.client] -ErrorAction SilentlyContinue
        if (-not $clientCommand) {
            Write-Host "正在安装 $($names[$payload.client])，网络慢时请耐心等待..." -ForegroundColor Cyan
            if ($payload.client -eq 'claude' -or $payload.client -eq 'grok') {
                $installerUrl = if ($payload.client -eq 'claude') { 'https://claude.ai/install.ps1' } else { 'https://x.ai/cli/install.ps1' }
                Invoke-NativeInstaller $installerUrl
            } else {
                $package = if ($payload.client -eq 'codex') { '@openai/codex' } else { '@deepseek-ai/dsh' }
                & $npm install --prefix $tools --no-audit --no-fund --registry=https://registry.npmjs.org $package
                if ($LASTEXITCODE -ne 0) { throw 'Client installation failed' }
            }
        }
    }
    if ($payload.mode -eq 'setup' -or $payload.mode -eq 'install') {
        if (-not (Get-Command $commands[$payload.client] -ErrorAction SilentlyContinue)) { throw 'Client command not found after installation' }
    }
    if ($payload.mode -eq 'install') {
        Write-Host '客户端安装完成。请返回网页，点击“已经装好，下一步”下载配置工具。' -ForegroundColor Green
        exit 0
    }
    $stage = '备份并写入配置'
    if ($payload.mode -eq 'restore') { $stage = '恢复原配置' }
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $backupDirectory = Join-Path $root '.wukongai-setup-backup'
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $acl = Get-Acl -LiteralPath $backupDirectory
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $backupDirectory -AclObject $acl
    $worker = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__WORKER__'))
    $workerPath = Join-Path $tools 'wukongai-config-worker.mjs'
    [IO.File]::WriteAllText($workerPath, $worker, [Text.UTF8Encoding]::new($false))
    $payload | ConvertTo-Json -Compress | & $node $workerPath wukongai-config $root $tools
    if ($LASTEXITCODE -ne 0) { throw 'Configuration worker failed' }
    if ($payload.mode -eq 'restore') {
        Write-Host '已恢复接入前的配置。请重新打开客户端，并按官方方式登录。' -ForegroundColor Green
    } else {
        Write-Host '配置完成，正在打开客户端。原配置已保存，切回官方版可用恢复工具。' -ForegroundColor Green
        $env:Path = (Join-Path $tools 'node_modules\.bin') + ';' + (Join-Path $env:USERPROFILE '.local\bin') + ';' + (Join-Path $env:USERPROFILE '.grok\bin') + ';' + $env:Path
        $command = $commands[$payload.client]
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw 'Client command not found after installation' }
        $arguments = if ($payload.client -eq 'deepseek') { '/k dsh web' } else { "/k $command" }
        Start-Process -FilePath $env:ComSpec -ArgumentList $arguments
    }
    exit 0
} catch {
    Write-Host "执行未完成：$stage。请检查网络、文件权限或客户端安装情况后重试。" -ForegroundColor Red
    Write-Host '工具不会跳过错误继续配置，也不会打印你的 API 密钥。' -ForegroundColor Yellow
    exit 1
}
