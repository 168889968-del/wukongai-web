function Get-WukongImagePython($Assets) {
    $runtime = Join-Path $env:LOCALAPPDATA 'WukongAi\image-runtime'
    $python = Join-Path $runtime 'venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $python) {
        & $python -c 'import openai, PIL' 2>$null
        if ($LASTEXITCODE -eq 0) { return $python }
    }
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $architecture = if ($architecture -eq 'ARM64') { 'arm64' } elseif ($architecture -eq 'AMD64') { 'x64' } else { throw 'Image tools require 64-bit Windows.' }
    $asset = $Assets.runtime.$architecture
    $folder = Join-Path $runtime ('uv-' + $Assets.runtime.version + '-' + $architecture)
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $uv = Join-Path $folder 'uv.exe'
    if (-not (Test-Path -LiteralPath $uv)) {
        $archive = Join-Path $folder 'uv.zip'
        if (-not (Test-Path -LiteralPath $archive)) { Save-CodexInstaller $asset.url $archive }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $asset.sha256) { throw 'Image runtime checksum mismatch; the download was not executed.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $folder -Force
        if (-not (Test-Path -LiteralPath $uv)) { throw 'The image runtime archive did not contain uv.exe.' }
    }
    $variables = @('UV_PYTHON_INSTALL_DIR','UV_CACHE_DIR','UV_NO_PROGRESS','UV_SYSTEM_CERTS','UV_PYTHON_INSTALL_REGISTRY','UV_PYTHON_INSTALL_BIN')
    $previous = @{}
    foreach ($name in $variables) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
    try {
        $env:UV_PYTHON_INSTALL_DIR = Join-Path $runtime 'python'
        $env:UV_CACHE_DIR = Join-Path $runtime 'cache'
        $env:UV_NO_PROGRESS = '1'
        $env:UV_SYSTEM_CERTS = 'true'
        $env:UV_PYTHON_INSTALL_REGISTRY = 'false'
        $env:UV_PYTHON_INSTALL_BIN = 'false'
        if (-not (Test-Path -LiteralPath $python)) {
            & $uv venv --managed-python --python 3.13 (Join-Path $runtime 'venv') | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Unable to prepare the isolated image Python runtime.' }
        }
        & $uv pip install --python $python 'openai>=2,<3' 'pillow>=11,<13' | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Unable to install the image API dependencies.' }
        & $python -c 'import openai, PIL'
        if ($LASTEXITCODE -ne 0) { throw 'The image API dependencies are incomplete.' }
    } finally {
        foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    }
    return $python
}

function Install-WukongImageSupport([string]$Base, [string]$Key, [string]$CodexRoot) {
    $assets = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($wukongImageFilesEncoded)) | ConvertFrom-Json
    Write-Host '正在准备悟空Ai生图工具和独立 Python 环境，首次运行需要下载依赖。' -ForegroundColor Cyan
    $python = Get-WukongImagePython $assets
    $folder = Join-Path $CodexRoot 'skills\wukongai-imagegen'
    $scripts = Join-Path $folder 'scripts'
    New-Item -ItemType Directory -Path $scripts -Force | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [IO.Directory]::GetAccessControl($scripts, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    [IO.Directory]::SetAccessControl($scripts, $acl)
    [IO.File]::WriteAllText((Join-Path $folder 'SKILL.md'), $assets.skill, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $folder 'LICENSE.OpenAI.txt'), $assets.license, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $scripts 'image_gen.py'), $assets.cli, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $scripts 'run.ps1'), $assets.run, [Text.UTF8Encoding]::new($true))
    [IO.File]::WriteAllText((Join-Path $scripts 'read-key.ps1'), $assets.readKey, [Text.UTF8Encoding]::new($true))
    [IO.File]::WriteAllText((Join-Path $scripts 'config.json'), (@{base=($Base.TrimEnd('/')+'/v1');model='gpt-image-2';python=$python} | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
    Add-Type -AssemblyName System.Security
    $encrypted = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($Key), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes((Join-Path $scripts 'key.bin'), $encrypted)
    Write-Host '悟空Ai API 生图已配置。重新打开 Codex 聊天后，可要求“用悟空Ai生成图片”，无需再填写密钥或代码。' -ForegroundColor Green
}
