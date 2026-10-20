import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import YAML from 'yaml'

import codexRunner from '../codex-desktop.ps1?raw'
import runner from '../desktop-clients.ps1?raw'
import releases from '../desktop-releases.json'
import { configure } from '../windows-config.mjs'
import bootstrap from '../windows-runner.ps1?raw'
import { buildWindowsTool } from '../windows-tools'

const roots: string[] = []
function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-graphical-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== os.tmpdir() ||
      !path.basename(root).startsWith('wukongai-graphical-')
    ) {
      throw new Error('Unexpected test directory')
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 180000)
function execute(script: string, timeout = 60000) {
  const root = temporaryRoot()
  const file = path.join(root, 'check.ps1')
  const shared = bootstrap
    .replaceAll('\r\n', '\n')
    .split('\ntry {\n    $payload')[0]
  fs.writeFileSync(
    file,
    `\ufeff${shared}\n${codexRunner.split('# WUKONGAI_DESKTOP_MAIN')[0]}\n${runner.split('# WUKONGAI_GRAPHICAL_MAIN')[0]}\n${script}`
  )
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    {
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      env: { ...process.env, WUKONGAI_TEST_ROOT: root },
    }
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  return root
}

describe('MSIX administrator consent', () => {
  it('installs without elevation when Windows accepts the current token', () => {
    execute(`
function Assert-WukongMsixRequirements { }
function Add-AppxPackage { param($Path, $ErrorAction) $script:installed = $Path }
function Start-Process { throw 'Unexpected administrator prompt' }
Install-WukongMsix 'existing.msix'
if ($script:installed -ne 'existing.msix') { throw 'Installer was not called' }
`)
  })

  it('retries packaged-service failures with installation-only administrator consent', () => {
    execute(`
function Assert-WukongMsixRequirements { }
$installer = Join-Path $env:WUKONGAI_TEST_ROOT "安装包's.msix"
[IO.File]::WriteAllText($installer, 'test installer')
$payload = @{ key = 'sk-test-never-elevate'; base = 'https://wukongai.work' }
function Add-AppxPackage { throw 'Deployment failed with HRESULT: 0x80073D28' }
function Start-Process {
    param($FilePath, $Verb, $ArgumentList, [switch]$PassThru, [switch]$Wait)
    if ($Verb -ne 'RunAs' -or -not $Wait -or -not $PassThru) { throw 'Missing administrator consent or wait' }
    $encoded = ($ArgumentList -split ' ')[-1]
    $code = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encoded))
    if ($code -match 'sk-test|payload|Set-ClaudeDesktopGateway|config.toml') { throw 'Configuration leaked into elevated helper' }
    if ($code -notmatch 'exit 83' -or $code -notmatch 'exit 84' -or $code -notmatch 'Add-AppxPackage') { throw 'Missing account or checksum validation' }
    $errors = $null
    $tokens = $null
    [Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) { throw 'Invalid elevated helper syntax' }
    # Execute fixed helper in this disposable process with its installer mocked.
    $script:helper = $code.Replace('exit 0', 'return').Replace('exit 83', "throw 'wrong user'").Replace('exit 84', "throw 'wrong hash'")
    return @{ ExitCode = 0 }
}
Install-WukongMsix $installer
function Add-AppxPackage { param($Path, $ErrorAction) $script:installed = $Path }
Invoke-Expression $script:helper
if ([IO.Path]::GetFullPath($script:installed) -ne [IO.Path]::GetFullPath($installer)) { throw "Incorrect Unicode or quoted installer path: $script:installed versus $installer" }
if ($payload.key -ne 'sk-test-never-elevate') { throw 'Parent configuration changed' }
`)
  })

  it('stops on rejected consent, another administrator account, or installer failure', () => {
    execute(`
function Assert-WukongMsixRequirements { }
$installer = Join-Path $env:WUKONGAI_TEST_ROOT 'test.msix'
[IO.File]::WriteAllText($installer, 'test')
function Add-AppxPackage { throw '0x80073D28' }
foreach ($status in @(83, 84, 85, 1223)) {
    $script:status = $status
    function Start-Process { if ($script:status -eq 1223) { throw 'Operation cancelled' }; return @{ ExitCode = $script:status } }
    $failed = $false
    try { Install-WukongMsix $installer } catch { $failed = $true }
    if (-not $failed) { throw "False success for exit code $status" }
}
`)
  })

  it('preserves unrelated installation errors without asking for elevation', () => {
    execute(`
function Assert-WukongMsixRequirements { }
function Add-AppxPackage { throw '0x80073CF3 missing dependency' }
function Start-Process { throw 'Unexpected administrator prompt' }
try { Install-WukongMsix 'test.msix'; throw 'False success' }
catch { if ($_ -notmatch '0x80073CF3') { throw } }
`)
  })
})

describe('Claude protected policy configuration', () => {
  it('detects real registry ACL denial and requests consent without changing the original values', () => {
    execute(`
$policy = 'SOFTWARE\\WukongAiDesktopTest\\' + [guid]::NewGuid().ToString('N')
$registry = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($policy)
$originalAcl = $registry.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
try {
    $registry.SetValue('inferenceProvider', 'original')
    $lockedAcl = [Security.AccessControl.RegistrySecurity]::new()
    $lockedAcl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $lockedAcl.AddAccessRule([Security.AccessControl.RegistryAccessRule]::new($sid, 'ReadKey', 'Allow'))
    $registry.SetAccessControl($lockedAcl)
    function Invoke-ClaudePolicyElevation { $script:requested = $true }
    Set-ClaudeDesktopGateway @{mode='setup';base='https://wukongai.work';key='sk-acl-test';model='claude-test'} (Join-Path $env:WUKONGAI_TEST_ROOT 'backup') $policy
    if (-not $script:requested) { throw 'Actual registry access denial did not request consent' }
    if ($registry.GetValue('inferenceProvider') -ne 'original') { throw 'Policy changed before consent' }
} finally {
    $registry.SetAccessControl($originalAcl)
    $registry.Dispose()
    [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($policy, $false)
}
`)
  })

  it('requests configuration consent only for registry permission failures', () => {
    execute(`
function Set-ClaudeDesktopGatewayCore { throw [UnauthorizedAccessException]::new('Protected policy') }
function Invoke-ClaudePolicyElevation {
    param($Configuration, $BackupDirectory, $PolicyPath)
    if ($Configuration.key -ne 'sk-consent-test' -or $PolicyPath -ne 'SOFTWARE\\WukongAiDesktopTest' -or $BackupDirectory -ne 'backup') { throw 'Wrong user configuration' }
    $script:consent = $true
}
Set-ClaudeDesktopGateway @{mode='setup';key='sk-consent-test'} 'backup' 'SOFTWARE\\WukongAiDesktopTest'
if (-not $script:consent) { throw 'Missing configuration consent' }
$script:consent = $false
function Set-ClaudeDesktopGatewayCore { throw 'Machine policy blocks configuration' }
try { Set-ClaudeDesktopGateway @{} 'backup'; throw 'False success' }
catch { if ($_ -notmatch 'Machine policy') { throw } }
if ($script:consent) { throw 'Unexpected elevation for management policy' }
`)
  })

  it('passes secrets with DPAPI and configures and restores the original user through a real child process', () => {
    execute(
      `
$env:TEMP = $env:WUKONGAI_TEST_ROOT
$env:TMP = $env:WUKONGAI_TEST_ROOT
$policy = 'SOFTWARE\\WukongAiDesktopTest\\' + [guid]::NewGuid().ToString('N')
$backup = Join-Path $env:WUKONGAI_TEST_ROOT 'backup'
function Start-Process {
    param($FilePath, $Verb, $ArgumentList, [switch]$PassThru, [switch]$Wait)
    if ($Verb -ne 'RunAs' -or -not $Wait) { throw 'Missing administrator consent' }
    $encoded = ($ArgumentList -split ' ')[-1]
    $code = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encoded))
    if ($code -match 'sk-dpapi-test|claude-private-test') { throw 'Secret or configuration leaked to command line' }
    if ($code.Length * 8 / 3 -gt 30000) { throw 'Elevated command exceeds Windows limit' }
    if ($code.IndexOf('exit 83') -gt $code.IndexOf('::Unprotect')) { throw 'Wrong account can access request' }
    $requestFile = @(Get-ChildItem -LiteralPath $env:WUKONGAI_TEST_ROOT -Filter request.bin -Recurse)
    if ($requestFile.Count -ne 1) { throw 'Missing encrypted request' }
    $bytes = [IO.File]::ReadAllBytes($requestFile[0].FullName)
    if ([Text.Encoding]::UTF8.GetString($bytes) -match 'sk-dpapi-test') { throw 'Plaintext secret on disk' }
    $plain = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
    $request = $plain | ConvertFrom-Json
    if ($request.configuration.mode -eq 'setup' -and $request.configuration.key -ne 'sk-dpapi-test') { throw 'Invalid encrypted request' }
    $acl = [IO.Directory]::GetAccessControl($requestFile[0].DirectoryName, [Security.AccessControl.AccessControlSections]::Access)
    if (-not $acl.AreAccessRulesProtected) { throw 'Request directory is not private' }
    & $FilePath -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
    return @{ExitCode=$LASTEXITCODE}
}
try {
    $registry = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($policy)
    $registry.SetValue('inferenceProvider', 'original')
    $registry.SetValue('unrelated', 'preserve')
    $registry.Dispose()
    Invoke-ClaudePolicyElevation @{mode='setup';base='https://wukongai.work';key='sk-dpapi-test';model='claude-private-test'} $backup $policy
    $registry = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($policy)
    if ($registry.GetValue('inferenceGatewayApiKey') -ne 'sk-dpapi-test') { throw 'Child did not configure original user' }
    $registry.Dispose()
    Invoke-ClaudePolicyElevation @{mode='restore'} $backup $policy
    $registry = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($policy)
    if ($registry.GetValue('inferenceProvider') -ne 'original' -or $registry.GetValue('inferenceGatewayApiKey') -ne $null -or $registry.GetValue('unrelated') -ne 'preserve') { throw 'Child restore lost original policy' }
    $registry.Dispose()
    if (@(Get-ChildItem -LiteralPath $env:WUKONGAI_TEST_ROOT -Filter request.bin -Recurse).Count) { throw 'Encrypted request was not removed' }
} finally { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($policy, $false) }
`,
      40000
    )
  })

  it('cleans encrypted requests when consent is cancelled or another account or write fails', () => {
    execute(`
$env:TEMP = $env:WUKONGAI_TEST_ROOT
$env:TMP = $env:WUKONGAI_TEST_ROOT
foreach ($status in @(83, 85, 1223)) {
    $script:status = $status
    function Start-Process { if ($script:status -eq 1223) { throw 'Cancelled' }; return @{ExitCode=$script:status} }
    $failed = $false
    try { Invoke-ClaudePolicyElevation @{mode='setup';key='sk-cancel-test'} $env:WUKONGAI_TEST_ROOT 'SOFTWARE\\WukongAiDesktopTest' }
    catch { $failed = $true }
    if (-not $failed) { throw 'False success' }
    if (@(Get-ChildItem -LiteralPath $env:WUKONGAI_TEST_ROOT -Filter request.bin -Recurse).Count) { throw 'Encrypted request remains after failure' }
}
`)
  })

  it('keeps managed bootstrap settings unchanged even when a previous backup exists', () => {
    execute(`
$policy = 'SOFTWARE\\WukongAiDesktopTest\\' + [guid]::NewGuid().ToString('N')
$backup = Join-Path $env:WUKONGAI_TEST_ROOT 'backup'
try {
    Set-ClaudeDesktopGateway @{mode='setup';base='https://wukongai.work';key='sk-first-test';model='claude-test'} $backup $policy
    $registry = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($policy)
    $registry.SetValue('bootstrapUrl', 'https://managed.example/config')
    $registry.SetValue('inferenceProvider', 'managed')
    $registry.Dispose()
    function Invoke-ClaudePolicyElevation { throw 'Unexpected elevation for managed policy' }
    try { Set-ClaudeDesktopGateway @{mode='setup';base='https://wukongai.work';key='sk-second-test';model='claude-test'} $backup $policy; throw 'False success' }
    catch { if ($_ -notmatch 'managed by a bootstrap server') { throw } }
    $registry = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($policy)
    if ($registry.GetValue('inferenceProvider') -ne 'managed') { throw 'Managed policy overwritten by stale backup' }
    $registry.Dispose()
} finally { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($policy, $false) }
`)
  })
})

describe('Desktop-specific configuration formats', () => {
  it('writes DeepSeek desktop profile overlays and versioned credentials, preserving other keys', () => {
    const root = temporaryRoot()
    const profile = path.join(root, 'profiles', 'desktop')
    fs.mkdirSync(profile, { recursive: true })
    const patch = '- id: existing-plugin\n  disabled: true\n'
    const credentials =
      'version: 1\nrefs:\n  EXISTING_KEY: original\nrecords: {}\n'
    fs.writeFileSync(path.join(profile, 'cordis.patch.yml'), patch)
    fs.writeFileSync(path.join(root, '.credentials.yaml'), credentials)
    configure(
      {
        client: 'deepseek',
        mode: 'setup',
        desktop: true,
        base: 'https://wukongai.work',
        key: 'sk-deepseek-test',
        model: 'deepseek-test',
      },
      root,
      process.cwd()
    )
    const changes = YAML.parse(
      fs.readFileSync(path.join(profile, 'cordis.patch.yml'), 'utf8')
    )
    expect(
      changes.find((x: { id: string }) => x.id === 'llm-pi-ai').config.providers
        .wukongai.baseURL
    ).toBe('https://wukongai.work/v1')
    expect(
      changes.find((x: { id: string }) => x.id === 'agent-default-model').config
        .model
    ).toBe('deepseek-test')
    expect(
      YAML.parse(fs.readFileSync(path.join(root, '.credentials.yaml'), 'utf8'))
        .refs
    ).toEqual({
      EXISTING_KEY: 'original',
      WUKONGAI_API_KEY: 'sk-deepseek-test',
    })
    configure(
      { client: 'deepseek', mode: 'restore', desktop: true },
      root,
      process.cwd()
    )
    expect(
      fs.readFileSync(path.join(profile, 'cordis.patch.yml'), 'utf8')
    ).toBe(patch)
    expect(fs.readFileSync(path.join(root, '.credentials.yaml'), 'utf8')).toBe(
      credentials
    )
  })
  it('configures both the Grok engine and the graphical app without putting keys in launch arguments', () => {
    const root = temporaryRoot()
    configure(
      {
        client: 'grok',
        mode: 'setup',
        desktop: true,
        desktopCli: 'C:/Grok/grok.exe',
        base: 'https://wukongai.work',
        key: 'sk-grok-test',
        model: 'grok-test',
      },
      root,
      process.cwd()
    )
    const desktop = JSON.parse(
      fs.readFileSync(path.join(root, 'desktop-config.json'), 'utf8')
    )
    expect(desktop).toEqual({
      'grok.cliPath': 'C:/Grok/grok.exe',
      'grok.defaultModel': 'wukongai',
    })
    expect(JSON.stringify(desktop)).not.toContain('sk-grok-test')
    configure(
      { client: 'grok', mode: 'restore', desktop: true },
      root,
      process.cwd()
    )
    expect(fs.existsSync(path.join(root, 'desktop-config.json'))).toBe(false)
  })
})

describe.skipIf(process.platform !== 'win32')(
  'Graphical Windows installation',
  () => {
    it.skipIf(process.env.WUKONGAI_REAL_INSTALL_TESTS !== '1')(
      'installs and verifies all three graphical clients on the clean CI runner',
      () => {
        execute(
          `
$env:LOCALAPPDATA=$env:WUKONGAI_TEST_ROOT
$desktopReleases='${JSON.stringify(releases)}' | ConvertFrom-Json
foreach ($client in @('claude','grok','deepseek')) {
$launch=Install-GraphicalDesktop $client
if (-not $launch.target -or -not (Test-Path -LiteralPath $launch.target)) {throw "Desktop not installed: $client"}
Write-Host "Graphical desktop verified: $client"
}
`,
          1800000
        )
      },
      1860000
    )
    it.each(['claude', 'grok', 'deepseek'] as const)(
      '%s BAT parses without running its installer',
      (client) => {
        const root = temporaryRoot()
        const file = path.join(root, 'installer.ps1')
        fs.writeFileSync(
          file,
          `\ufeff${buildWindowsTool(client, 'install').split('# WUKONGAI_SCRIPT\r\n')[1]}`
        )
        const result = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            '$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile($env:WUKONGAI_PARSE_FILE,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|Out-String|Write-Error;exit 1}',
          ],
          {
            encoding: 'utf8',
            windowsHide: true,
            env: { ...process.env, WUKONGAI_PARSE_FILE: file },
          }
        )
        expect(result.status, result.stdout + result.stderr).toBe(0)
      }
    )
    it('checks installer hashes and refuses mismatched downloads', () => {
      execute(`
$env:LOCALAPPDATA=$env:WUKONGAI_TEST_ROOT
$env:PROCESSOR_ARCHITECTURE='AMD64';$env:PROCESSOR_ARCHITEW6432=''
$fixture=Join-Path $env:WUKONGAI_TEST_ROOT 'fixture.exe'
[IO.File]::WriteAllText($fixture,'expected installer bytes')
$hash=(Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash
$desktopReleases=@{grok=@{version='test';x64=@{url='https://example.invalid/test.exe';sha256=$hash}}}
function Save-CodexInstaller { param($Url,$Path) Copy-Item -LiteralPath $fixture -Destination $Path }
$path=Get-VerifiedDesktopInstaller 'grok'
if (-not (Test-Path -LiteralPath $path)) { throw 'Missing verified installer' }
[IO.File]::WriteAllText($path,'unexpected bytes')
try { Get-VerifiedDesktopInstaller 'grok';throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*mismatch*') {throw} }
`)
    })
    it.each(['grok', 'deepseek'])(
      'verifies %s has a graphical executable after installation',
      (client) => {
        execute(`
$env:LOCALAPPDATA=$env:WUKONGAI_TEST_ROOT
function Get-VerifiedDesktopInstaller { 'fixture-installer.exe' }
function Start-Process { param($FilePath,$ArgumentList,[switch]$PassThru,[switch]$Wait,$WindowStyle)
if (-not $ArgumentList.StartsWith('/S /D=')) {throw 'Not a silent desktop install'}
$destination=$ArgumentList.Substring(6)
New-Item -ItemType Directory -Path $destination -Force|Out-Null
$product=if('${client}' -eq 'grok') {'Grok Build Desktop'} else {'DeepSeek Harness'}
[IO.File]::WriteAllText((Join-Path $destination "$product.exe"),'fixture executable')
[pscustomobject]@{ExitCode=0}
}
$launch=Install-GraphicalDesktop '${client}'
if ($launch.target -notlike '*.exe' -or -not (Test-Path -LiteralPath $launch.target)) {throw 'Missing graphical application'}
`)
      }
    )
    it('backs up, configures, and restores Claude user policy without touching an installed Claude app', () => {
      execute(`
$policy='SOFTWARE\\WukongAiDesktopTest\\'+[guid]::NewGuid().ToString('N')
$backup=Join-Path $env:WUKONGAI_TEST_ROOT 'backup'
try {
$registry=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($policy)
$registry.SetValue('inferenceProvider','previous')
$registry.SetValue('unrelated','preserve')
$registry.Dispose()
Set-ClaudeDesktopGateway @{mode='setup';base='https://wukongai.work';key='sk-local-test';model='claude-test'} $backup $policy
$registry=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($policy)
if ($registry.GetValue('inferenceProvider') -ne 'gateway' -or $registry.GetValue('inferenceGatewayApiKey') -ne 'sk-local-test') {throw 'Gateway configuration failed'}
$registry.Dispose()
Set-ClaudeDesktopGateway @{mode='restore'} $backup $policy
$registry=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($policy)
if ($registry.GetValue('inferenceProvider') -ne 'previous' -or $registry.GetValue('inferenceGatewayApiKey') -ne $null -or $registry.GetValue('unrelated') -ne 'preserve') {throw 'Original registry settings lost'}
$registry.Dispose()
} finally { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($policy,$false) }
`)
    })
    it('rejects models unavailable to the supplied key', () => {
      execute(`
function Invoke-RestMethod { @{data=@(@{id='claude-test'},@{id='grok-test'},@{id='deepseek-test'})} }
foreach ($client in @('claude','grok','deepseek')) {
if ((Get-WukongDesktopModel $client 'https://wukongai.work' 'test-key' '') -ne "$client-test") {throw 'Wrong model family'}
}
try { Get-WukongDesktopModel 'claude' 'https://wukongai.work' 'test-key' 'claude-missing';throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*当前 API 密钥没有所选模型的使用权限*') {throw} }
`)
    })
    it('rejects GPT in Claude before requesting models from the gateway', () => {
      execute(`
function Invoke-RestMethod { throw 'MUST_NOT_REQUEST' }
try { Get-WukongDesktopModel 'claude' 'https://wukongai.work' 'sk-test-only' 'gpt-6.1-sol';throw 'Unexpected success' }
catch { if ($_.Exception.Message -notlike '*ChatGPT / Codex*') {throw} }
`)
    })
  }
)

it('pins executable releases to verified upstream checksums and marks the Grok community distribution', () => {
  expect(releases.grok.community).toBe(true)
  expect(releases.grok.x64.sha256).toMatch(/^[a-f0-9]{64}$/i)
  expect(releases.claude.x64.sha256).toMatch(/^[a-f0-9]{64}$/i)
  expect(Buffer.from(releases.deepseek.x64.sha512, 'base64')).toHaveLength(64)
})
