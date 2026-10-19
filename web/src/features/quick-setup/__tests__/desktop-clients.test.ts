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
})
function execute(script: string, timeout = 20000) {
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
try { Get-WukongDesktopModel 'claude' 'https://wukongai.work' 'test-key' 'missing';throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*not available*') {throw} }
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
