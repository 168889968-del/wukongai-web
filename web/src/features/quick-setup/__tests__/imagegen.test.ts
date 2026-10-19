import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as TOML from '@iarna/toml'
import { afterEach, describe, expect, it } from 'vitest'

import codex from '../codex-desktop.ps1?raw'
import cli from '../imagegen/image_gen.py?raw'
import installer from '../imagegen/install.ps1?raw'
import { configure } from '../windows-config.mjs'
import bootstrap from '../windows-runner.ps1?raw'
import { buildWindowsTool } from '../windows-tools'

const roots: string[] = []
function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-images-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== os.tmpdir() ||
      !path.basename(root).startsWith('wukongai-images-')
    ) {
      throw new Error('Unexpected test directory')
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 180000)
function execute(root: string, script: string, timeout = 60000) {
  const file = path.join(root, 'check.ps1')
  const assets = buildWindowsTool('codex', 'images').match(
    /\$wukongImageFilesEncoded = '([^']+)'/
  )?.[1]
  if (!assets) {
    throw new Error('Image assets are missing from the BAT')
  }
  fs.writeFileSync(
    file,
    `\ufeff${bootstrap.replaceAll('\r\n', '\n').split('\ntry {\n    $payload')[0]}\n${codex.split('# WUKONGAI_DESKTOP_MAIN')[0]}\n${installer}\n$wukongImageFilesEncoded = '${assets}'\n${script}`
  )
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    {
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      env: { ...process.env, WUKONGAI_IMAGE_TEST_ROOT: root },
    }
  )
  expect(
    result.status,
    result.stdout + result.stderr + (result.error?.message || '')
  ).toBe(0)
}

it('repairs the missing provider without replacing the active ChatGPT login or model, and restores exact originals', () => {
  const root = temporaryRoot()
  const config = 'model = "gpt-6.1-sol"\n[features]\ncustom = true\n'
  const auth =
    '{"auth_mode":"chatgpt","tokens":{"access_token":"fixture-chatgpt-token"}}\n'
  fs.writeFileSync(path.join(root, 'config.toml'), config)
  fs.writeFileSync(path.join(root, 'auth.json'), auth)
  configure(
    {
      client: 'codex',
      mode: 'setup',
      base: 'https://wukongai.work',
      key: 'sk-image-test',
      model: 'gpt-image-2',
      repairProviderOnly: true,
    },
    root,
    process.cwd()
  )
  const repaired = TOML.parse(
    fs.readFileSync(path.join(root, 'config.toml'), 'utf8')
  ) as {
    model: string
    model_provider?: string
    model_providers: { wukongai: { auth: { command: string; args: string[] } } }
  }
  expect(repaired.model).toBe('gpt-6.1-sol')
  expect(repaired.model_provider).toBeUndefined()
  expect(repaired.model_providers.wukongai.auth.command).toMatch(
    /powershell.exe$/
  )
  expect(repaired.model_providers.wukongai.auth.args.join(' ')).not.toContain(
    'sk-image-test'
  )
  expect(fs.readFileSync(path.join(root, 'auth.json'), 'utf8')).toBe(auth)
  const keyFile = path.join(root, 'skills/wukongai-imagegen/scripts/key.bin')
  fs.mkdirSync(path.dirname(keyFile), { recursive: true })
  fs.writeFileSync(keyFile, Buffer.from([0, 255, 1, 200]))
  configure({ client: 'codex', mode: 'restore' }, root, process.cwd())
  expect(fs.readFileSync(path.join(root, 'config.toml'), 'utf8')).toBe(config)
  expect(fs.readFileSync(path.join(root, 'auth.json'), 'utf8')).toBe(auth)
  expect(fs.existsSync(keyFile)).toBe(false)
})

it('does not delete image files absent from an older backup manifest', () => {
  const root = temporaryRoot()
  const backup = path.join(root, '.wukongai-setup-backup')
  fs.mkdirSync(backup)
  fs.writeFileSync(
    path.join(backup, 'state.json'),
    JSON.stringify({
      client: 'codex',
      active: true,
      existed: { 'config.toml': false, 'auth.json': false },
    })
  )
  const skill = path.join(root, 'skills/wukongai-imagegen/SKILL.md')
  fs.mkdirSync(path.dirname(skill), { recursive: true })
  fs.writeFileSync(skill, 'Existing image skill')
  configure({ client: 'codex', mode: 'restore' }, root, process.cwd())
  expect(fs.readFileSync(skill, 'utf8')).toBe('Existing image skill')
})

it('keeps the bundled OpenAI CLI unmodified and embeds a public configuration BAT without a key', () => {
  expect(createHash('sha256').update(cli).digest('hex')).toBe(
    '3666b807de3f0a1d0a4a767b886d612c0b8f71025c500bba6693d1c6995a0873'
  )
  const bat = buildWindowsTool('codex', 'images')
  const encoded = bat.match(/\$payload = .*?FromBase64String\('([^']+)'\)/)?.[1]
  if (!encoded) {
    throw new Error('Image configuration payload is missing')
  }
  expect(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))).toEqual({
    client: 'codex',
    mode: 'images',
  })
  expect(bat).not.toContain('__IMAGEFILES__')
  expect(bat).toContain('Read-WukongApiKey')
})

describe.skipIf(process.platform !== 'win32')(
  'Windows image deployment',
  () => {
    it('stores a DPAPI credential and a UTF-8 runtime path, without writing keys to configuration or changing global environment', () => {
      const root = temporaryRoot()
      fs.writeFileSync(
        path.join(root, 'public.bat'),
        buildWindowsTool('codex', 'images')
      )
      execute(
        root,
        `
function Get-WukongImagePython { return 'C:\\测试路径\\python.exe' }
$root=Join-Path $env:WUKONGAI_IMAGE_TEST_ROOT '中文目录'
$env:OPENAI_API_KEY='leave-existing-value'
Install-WukongImageSupport 'https://wukongai.work' 'sk-dpapi-image-fixture' $root
$folder=Join-Path $root 'skills\\wukongai-imagegen\\scripts'
$config=[IO.File]::ReadAllText((Join-Path $folder 'config.json')) | ConvertFrom-Json
if ($config.python -ne 'C:\\测试路径\\python.exe' -or $config.base -ne 'https://wukongai.work/v1') { throw 'Unicode runtime path or API base is incorrect' }
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $folder 'key.bin')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
if ([Text.Encoding]::UTF8.GetString($key) -ne 'sk-dpapi-image-fixture') { throw 'DPAPI credential incorrect' }
if ([IO.File]::ReadAllText((Join-Path $folder 'config.json')).Contains('sk-dpapi-image-fixture')) { throw 'Plaintext credential in config' }
if ($env:OPENAI_API_KEY -ne 'leave-existing-value') { throw 'Global credential was replaced' }
$tokens=$null; $errors=$null
$bat=[IO.File]::ReadAllText('${path.join(root, 'public.bat').replaceAll("'", "''")}')
$script=($bat -split '(?m)^# WUKONGAI_SCRIPT\\r?$',2)[1]
[Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count) { throw 'Invalid public image BAT' }
`
      )
    })

    it('does not treat an image-only API key as a Codex chat model', () => {
      execute(
        temporaryRoot(),
        `
function Invoke-RestMethod { return @{data=@(@{id='gpt-image-2'})} }
try { Get-WukongCodexModel 'https://wukongai.work' 'sk-test'; throw 'Image model used for chat' }
catch { if ($_ -notmatch 'no GPT/Codex models') { throw } }
`
      )
    })

    it.skipIf(process.env.WUKONGAI_REAL_INSTALL_TESTS !== '1')(
      'installs the real isolated runtime and calls the unchanged SDK CLI through a local mock image API',
      async () => {
        const root = temporaryRoot()
        const portFile = path.join(root, 'port.txt')
        const records = path.join(root, 'requests.jsonl')
        const flag = path.join(root, 'reject.txt')
        const fixture = path.join(root, 'server.cjs')
        fs.writeFileSync(
          fixture,
          `const fs=require('node:fs'),http=require('node:http');http.createServer((req,res)=>{let data='';req.on('data',x=>data+=x);req.on('end',()=>{const b=data?JSON.parse(data):{};fs.appendFileSync(${JSON.stringify(records)},JSON.stringify({url:req.url,authorized:req.headers.authorization==='Bearer sk-sdk-fixture',model:b.model})+'\\n');res.setHeader('Content-Type','application/json');if(fs.existsSync(${JSON.stringify(flag)})){res.writeHead(403);res.end(JSON.stringify({error:{message:'fixture rejected sk-sdk-fixture'}}));}else if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'gpt-image-2'}]}));}else{res.end(JSON.stringify({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII='}]}));}})}).listen(0,'127.0.0.1',function(){fs.writeFileSync(${JSON.stringify(portFile)},String(this.address().port));});`
        )
        const server = spawn(process.execPath, [fixture], {
          windowsHide: true,
          stdio: 'ignore',
        })
        try {
          for (let n = 0; !fs.existsSync(portFile) && n < 100; n++) {
            await new Promise((r) => setTimeout(r, 100))
          }
          const port = fs.readFileSync(portFile, 'utf8')
          execute(
            root,
            `
$env:LOCALAPPDATA=Join-Path $env:WUKONGAI_IMAGE_TEST_ROOT '隔离运行环境'
$root=Join-Path $env:WUKONGAI_IMAGE_TEST_ROOT '中文目录'
Install-WukongImageSupport 'http://127.0.0.1:${port}' 'sk-sdk-fixture' $root
$script=Join-Path $root 'skills\\wukongai-imagegen\\scripts\\run.ps1'
$output=Join-Path $env:WUKONGAI_IMAGE_TEST_ROOT 'image.png'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Prompt 'Fixture image' -Out $output -Quality low
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) { throw 'SDK image generation failed' }
[IO.File]::WriteAllText('${flag.replaceAll("'", "''")}', 'reject')
$ErrorActionPreference='Continue'
$result=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Prompt 'Fixture rejected' -Out ($output+'.failed.png') 2>&1)
$status=$LASTEXITCODE
$ErrorActionPreference='Stop'
if ($status -eq 0 -or (Test-Path -LiteralPath ($output+'.failed.png'))) { throw 'Rejected API call reported success' }
if (($result -join '\\n').Contains('sk-sdk-fixture')) { throw 'API error leaked credential' }
`,
            900000
          )
          const requests = fs
            .readFileSync(records, 'utf8')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
          expect(
            requests.some(
              (r) =>
                r.url === '/v1/images/generations' &&
                r.authorized &&
                r.model === 'gpt-image-2'
            )
          ).toBe(true)
          expect(
            fs
              .readFileSync(path.join(root, 'image.png'))
              .subarray(1, 4)
              .toString()
          ).toBe('PNG')
        } finally {
          server.kill()
        }
      },
      960000
    )
  }
)
