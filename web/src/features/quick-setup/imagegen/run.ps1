param(
    [string]$Prompt,
    [string]$PromptFile,
    [string]$Out,
    [string[]]$Image,
    [string]$Size = '1024x1024',
    [ValidateSet('low','medium','high','auto')][string]$Quality = 'medium',
    [switch]$Check,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$savedKey = $env:OPENAI_API_KEY
$savedBase = $env:OPENAI_BASE_URL
$savedPythonEncoding = $env:PYTHONIOENCODING
$savedPythonUtf8 = $env:PYTHONUTF8
try {
    $env:PYTHONIOENCODING = 'utf-8'
    $env:PYTHONUTF8 = '1'
    $configuration = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'config.json')) | ConvertFrom-Json
    if ($configuration.model -ne 'gpt-image-2') { throw 'Unsupported configured image model. Run configuration again.' }
    $endpoint = [uri]$configuration.base
    if ($endpoint.Scheme -ne 'https' -and $endpoint.Host -notin @('127.0.0.1','localhost')) { throw 'Image API must use HTTPS.' }
    $env:OPENAI_BASE_URL = $configuration.base
    if (-not $DryRun) {
        Add-Type -AssemblyName System.Security
        $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'key.bin')), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $env:OPENAI_API_KEY = [Text.Encoding]::UTF8.GetString($bytes)
        if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) { throw 'Image API key is missing.' }
    }
    if ($Check) {
        $models = Invoke-RestMethod -Uri ($configuration.base.TrimEnd('/') + '/models') -Headers @{Authorization=('Bearer ' + $env:OPENAI_API_KEY)} -TimeoutSec 30
        if ($configuration.model -notin @($models.data | ForEach-Object { $_.id })) { throw 'This API key does not allow gpt-image-2. Check the WukongAi token group and model permissions.' }
        Write-Output 'WukongAi image API configuration verified; no paid image request was sent.'
        exit 0
    }
    if (-not $Out) { $Out = Join-Path (Get-Location).Path ('output\imagegen\wukongai-' + [guid]::NewGuid().ToString('N') + '.png') }
    $arguments = @((Join-Path $PSScriptRoot 'image_gen.py'), $(if ($Image) { 'edit' } else { 'generate' }))
    if ($PromptFile) { $arguments += @('--prompt-file', [IO.Path]::GetFullPath($PromptFile)) }
    elseif ($Prompt) { $arguments += @('--prompt', $Prompt) }
    else { throw 'Supply -Prompt or -PromptFile.' }
    foreach ($file in $Image) { $arguments += @('--image', [IO.Path]::GetFullPath($file)) }
    $arguments += @('--model', $configuration.model, '--size', $Size, '--quality', $Quality, '--out', [IO.Path]::GetFullPath($Out))
    if ($DryRun) { $arguments += '--dry-run' }
    $nativePreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $configuration.python @arguments 2>&1)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $nativePreference }
    foreach ($line in $output) {
        $text = [string]$line
        if ($env:OPENAI_API_KEY) { $text = $text.Replace($env:OPENAI_API_KEY, '[API key]') }
        Write-Host $text
    }
    if ($code -ne 0) { throw 'Image generation failed. Check the API response, image permissions and channel balance.' }
} catch {
    $message = $_.Exception.Message
    if ($env:OPENAI_API_KEY) { $message = $message.Replace($env:OPENAI_API_KEY, '[API key]') }
    [Console]::Error.WriteLine($message)
    exit 1
} finally {
    $env:OPENAI_API_KEY = $savedKey
    $env:OPENAI_BASE_URL = $savedBase
    $env:PYTHONIOENCODING = $savedPythonEncoding
    $env:PYTHONUTF8 = $savedPythonUtf8
}
