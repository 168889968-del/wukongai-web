import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import runner from '../codex-desktop.ps1?raw'
import { buildWindowsTool } from '../windows-tools'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== os.tmpdir() ||
      !path.basename(root).startsWith('wukongai-desktop-')
    ) {
      throw new Error('Unexpected test directory')
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 180000)

function execute(script: string, timeout = 20000) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-desktop-'))
  roots.push(root)
  const file = path.join(root, 'check.ps1')
  const definitions = runner.split('# WUKONGAI_DESKTOP_MAIN')[0]
  fs.writeFileSync(
    file,
    `\ufeff$ErrorActionPreference='Stop'\n${definitions}\n${script}`
  )
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    {
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      env: { ...process.env, WUKONGAI_DESKTOP_TEST_ROOT: root },
    }
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  return { root, output: result.stdout }
}

describe.skipIf(process.platform !== 'win32')(
  'Codex official desktop installer',
  () => {
    it.skipIf(process.env.WUKONGAI_REAL_INSTALL_TESTS !== '1')(
      'installs and verifies the official desktop app on the clean CI runner',
      () => {
        execute(
          `
$env:LOCALAPPDATA=$env:WUKONGAI_DESKTOP_TEST_ROOT
$package=Install-CodexDesktop $env:WUKONGAI_DESKTOP_TEST_ROOT
if ($package.Name -ne 'OpenAI.Codex' -or -not (Test-Path -LiteralPath (Join-Path $package.InstallLocation 'AppxManifest.xml'))) { throw 'The official desktop app was not installed' }
Write-Host 'Official Codex desktop installation verified'
`,
          900000
        )
      },
      960000
    )
    it('preserves an installed version without downloading or downgrading', () => {
      const result = execute(`
function Get-CodexDesktop { [pscustomobject]@{ Version='99.0.0.0'; PackageFamilyName='OpenAI.Codex_test' } }
function Save-CodexInstaller { throw 'Must not download' }
function Add-AppxPackage { throw 'Must not reinstall' }
$package = Install-CodexDesktop $env:WUKONGAI_DESKTOP_TEST_ROOT
if ($package.Version -ne '99.0.0.0') { throw 'Installed version lost' }
`)
      expect(result.output).toContain('99.0.0.0')
    })

    it.each(['AMD64', 'ARM64'])(
      'installs a matching local MSIX and verifies registration for %s',
      (architecture) => {
        execute(`
$script:registered=$false
function Get-CodexDesktop { if ($script:registered) { [pscustomobject]@{ Version='26.10.19.0' } } }
function Add-AppxPackage { param($Path, $ErrorAction) if (-not (Test-Path -LiteralPath $Path)) { throw 'Missing MSIX' }; $script:registered=$true }
function Save-CodexInstaller { throw 'Must reuse local package' }
$env:PROCESSOR_ARCHITECTURE='${architecture}'
$env:PROCESSOR_ARCHITEW6432=''
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'source'
New-Item -ItemType Directory -Path $source | Out-Null
$arch=if ('${architecture}' -eq 'AMD64') {'x64'} else {'arm64'}
[IO.File]::WriteAllText((Join-Path $source 'AppxManifest.xml'), '<Package><Identity Name="OpenAI.Codex" Publisher="CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B" ProcessorArchitecture="'+$arch+'" Version="26.10.19.0" /></Package>')
[IO.Compression.ZipFile]::CreateFromDirectory($source, (Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'Codex-Windows安装包.Msix'))
$package=Install-CodexDesktop $env:WUKONGAI_DESKTOP_TEST_ROOT
if (-not $script:registered -or $package.Version -ne '26.10.19.0') { throw 'Desktop installation not verified' }
`)
      }
    )

    it('rejects an unrelated MSIX before attempting installation', () => {
      execute(`
function Get-CodexDesktop { return $null }
function Add-AppxPackage { throw 'Must never install this package' }
$env:PROCESSOR_ARCHITECTURE='AMD64'; $env:PROCESSOR_ARCHITEW6432=''
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'source'
New-Item -ItemType Directory -Path $source | Out-Null
[IO.File]::WriteAllText((Join-Path $source 'AppxManifest.xml'), '<Package><Identity Name="Another.App" Publisher="Unknown" ProcessorArchitecture="x64" /></Package>')
[IO.Compression.ZipFile]::CreateFromDirectory($source, (Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'Codex-Windows安装包.Msix'))
try { Install-CodexDesktop $env:WUKONGAI_DESKTOP_TEST_ROOT; throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*not the official*') { throw } }
`)
    })

    it('does not report success when Windows fails to register the app', () => {
      execute(`
function Get-CodexDesktop { return $null }
function Get-CodexMsixIdentity { [pscustomobject]@{ ProcessorArchitecture='x64'; Version='1.0.0.0' } }
function Add-AppxPackage { param($Path, $ErrorAction) }
$env:PROCESSOR_ARCHITECTURE='AMD64'; $env:PROCESSOR_ARCHITEW6432=''
[IO.File]::WriteAllText((Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'Codex-Windows安装包.Msix'), 'test')
try { Install-CodexDesktop $env:WUKONGAI_DESKTOP_TEST_ROOT; throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*did not register*') { throw } }
`)
    })

    it('uses the key-authorized model list and refuses keys without GPT models', () => {
      execute(`
function Invoke-RestMethod { param($Uri, $Headers, $TimeoutSec) if ($Uri -ne 'https://wukongai.work/v1/models' -or $Headers.Authorization -ne 'Bearer sk-test-only') { throw 'Incorrect endpoint or auth' }; @{ data=@(@{id='claude-example'},@{id='gpt-6.1-sol'}) } }
if ((Get-WukongCodexModel 'https://wukongai.work' 'sk-test-only') -ne 'gpt-6.1-sol') { throw 'Wrong model selected' }
function Invoke-RestMethod { @{ data=@(@{id='claude-example'}) } }
try { Get-WukongCodexModel 'https://wukongai.work' 'sk-test-only'; throw 'Unexpected success' } catch { if ($_.Exception.Message -notlike '*no GPT/Codex models*') { throw } }
`)
    })

    it('creates a real desktop shortcut to the registered graphical app', () => {
      const { root } = execute(`
function Start-Process { param($FilePath, $ArgumentList) if ($ArgumentList -ne 'shell:AppsFolder\\OpenAI.Codex_test!App') { throw "Wrong GUI launch: $ArgumentList" } }
$manifest=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'AppxManifest.xml'
[IO.File]::WriteAllText($manifest, '<Package><Applications><Application Id="App" /></Applications></Package>')
$package=[pscustomobject]@{InstallLocation=$env:WUKONGAI_DESKTOP_TEST_ROOT;PackageFamilyName='OpenAI.Codex_test'}
Open-CodexDesktop $package $env:WUKONGAI_DESKTOP_TEST_ROOT
`)
      expect(fs.existsSync(path.join(root, 'Codex - 悟空Ai.lnk'))).toBe(true)
    })

    it('supports Unicode shortcut names and parent directories independently of the system locale', () => {
      const { root } = execute(`
$directory=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT '中文桌面目录'
$target=Join-Path $env:WINDIR 'explorer.exe'
New-WukongDesktopShortcut (Join-Path $directory 'Claude - 悟空Ai.lnk') $target 'shell:AppsFolder\\Claude_test!App' '打开桌面客户端'
`)
      expect(
        fs.existsSync(path.join(root, '中文桌面目录', 'Claude - 悟空Ai.lnk'))
      ).toBe(true)
    })

    it('the downloaded BAT parses as PowerShell without executing an installation', () => {
      const bat = buildWindowsTool('codex', 'install')
      const script = bat.split('# WUKONGAI_SCRIPT\r\n')[1]
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-desktop-'))
      roots.push(root)
      const file = path.join(root, 'downloaded.ps1')
      fs.writeFileSync(file, `\ufeff${script}`)
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
    })

    it('the interactive deployment writes the supplied key, preserves settings, and restores the exact originals', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-desktop-'))
      roots.push(root)
      const config = path.join(root, 'config')
      const runtime = path.join(root, 'runtime')
      fs.mkdirSync(config)
      fs.mkdirSync(runtime)
      fs.symlinkSync(
        path.join(process.cwd(), 'node_modules'),
        path.join(runtime, 'node_modules'),
        'junction'
      )
      const originalConfig =
        'model = "previous-model"\n[projects."C:/project"]\ntrust_level = "trusted"\n'
      const originalAuth = '{"tokens":{"previous":"local-test-session"}}\n'
      fs.writeFileSync(path.join(config, 'config.toml'), originalConfig)
      fs.writeFileSync(path.join(config, 'auth.json'), originalAuth)
      const downloaded = buildWindowsTool('codex', 'install').split(
        '# WUKONGAI_SCRIPT\r\n'
      )[1]
      const mocks = `
$env:CODEX_HOME=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'config'
$tools=Join-Path $env:WUKONGAI_DESKTOP_TEST_ROOT 'runtime'
function Install-CodexDesktop { [pscustomobject]@{ Name='OpenAI.Codex';Version='26.10.19.0' } }
function Get-Node { $env:WUKONGAI_TEST_NODE }
function Open-CodexDesktop { param($Package) if ($Package.Name -ne 'OpenAI.Codex') { throw 'Expected desktop package' }; Write-Host 'Desktop opened' }
function Read-Host { param($Prompt, [switch]$AsSecureString) if ($AsSecureString) { return (ConvertTo-SecureString 'sk-interactive-test-only' -AsPlainText -Force) }; return $env:WUKONGAI_TEST_CHOICE }
function Invoke-RestMethod { param($Uri,$Headers,$TimeoutSec) if ($Uri -ne 'https://wukongai.work/v1/models' -or $Headers.Authorization -ne 'Bearer sk-interactive-test-only') { throw 'Unexpected API request' }; @{data=@(@{id='gpt-6.1-sol'})} }
`
      const file = path.join(root, 'interactive.ps1')
      fs.writeFileSync(
        file,
        `\ufeff${downloaded.replace('# WUKONGAI_DESKTOP_MAIN', `${mocks}\n# WUKONGAI_DESKTOP_MAIN`)}`
      )
      const env = {
        ...process.env,
        WUKONGAI_DESKTOP_TEST_ROOT: root,
        WUKONGAI_TEST_NODE: process.execPath,
        WUKONGAI_TEST_CHOICE: '1',
      }
      const run = () =>
        spawnSync(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
          { encoding: 'utf8', timeout: 30000, windowsHide: true, env }
        )
      const configured = run()
      expect(configured.status, configured.stdout + configured.stderr).toBe(0)
      expect(configured.stdout).toContain('Desktop opened')
      expect(configured.stdout).not.toContain('sk-interactive-test-only')
      expect(
        JSON.parse(fs.readFileSync(path.join(config, 'auth.json'), 'utf8'))
      ).toEqual({ OPENAI_API_KEY: 'sk-interactive-test-only' })
      const text = fs.readFileSync(path.join(config, 'config.toml'), 'utf8')
      expect(text).toContain('https://wukongai.work/v1')
      expect(text).toContain('gpt-6.1-sol')
      expect(text).toContain('trust_level = "trusted"')
      env.WUKONGAI_TEST_CHOICE = '3'
      const restored = run()
      expect(restored.status, restored.stdout + restored.stderr).toBe(0)
      expect(fs.readFileSync(path.join(config, 'config.toml'), 'utf8')).toBe(
        originalConfig
      )
      expect(fs.readFileSync(path.join(config, 'auth.json'), 'utf8')).toBe(
        originalAuth
      )
    })
  }
)
