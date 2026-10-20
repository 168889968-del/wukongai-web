import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as TOML from '@iarna/toml'
import { afterEach, describe, expect, it } from 'vitest'
import YAML from 'yaml'

import { isClientModelCompatible } from '../configuration'
import { configure } from '../windows-config.mjs'
import { buildWindowsTool, type WindowsClient } from '../windows-tools'

const dependencies = process.cwd()
const clients: WindowsClient[] = ['codex', 'claude', 'grok', 'deepseek']
const roots: string[] = []
function temporaryHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-tools-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(fs.realpathSync(root)) !== fs.realpathSync(os.tmpdir()) ||
      !path.basename(root).startsWith('wukongai-tools-')
    ) {
      throw new Error('Unexpected test directory')
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('Windows setup and restore tools', () => {
  it.each(clients)(
    '%s can download an installer without an API key',
    (client) => {
      const bat = buildWindowsTool(client, 'install')
      const encoded = bat.match(/FromBase64String\('([^']+)'\)/)?.[1]
      expect(
        JSON.parse(Buffer.from(encoded ?? '', 'base64').toString())
      ).toEqual({ client, mode: 'install' })
    }
  )
  it('runs the embedded worker through Node stdin with Unicode configuration', () => {
    const root = temporaryHome()
    const bat = buildWindowsTool('claude', 'setup', {
      base: 'https://wukongai.work',
      key: 'sk-local-test-only',
      model: 'claude-示例模型',
    })
    const parts = [...bat.matchAll(/FromBase64String\('([^']+)'\)/g)]
    const workerEncoded = bat.match(/\$wukongWorkerEncoded = '([^']+)'/)?.[1]
    const worker = Buffer.from(workerEncoded ?? '', 'base64').toString()
    const workerPath = path.join(root, 'worker.mjs')
    fs.writeFileSync(workerPath, worker)
    const result = spawnSync(
      process.execPath,
      [workerPath, 'wukongai-config', root, dependencies],
      { input: Buffer.from(parts[0][1], 'base64'), encoding: 'utf8' }
    )
    expect(result.status, result.stderr).toBe(0)
    expect(
      JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8')).env
        .ANTHROPIC_MODEL
    ).toBe('claude-示例模型')
  })
  it.each(clients)(
    '%s generates a self-contained BAT and keeps input out of executable code',
    (client) => {
      const key = "sk-example-'& echo unsafe | %PATH%"
      const model = client === 'claude' ? 'claude-example' : 'example-model'
      const bat = buildWindowsTool(client, 'setup', {
        base: 'https://wukongai.work',
        key,
        model,
      })
      expect(bat.startsWith('@echo off\r\n')).toBe(true)
      expect(bat).toContain('powershell.exe -NoProfile')
      expect(bat).not.toContain(key)
      const encoded = bat.match(/FromBase64String\('([^']+)'\)/)?.[1]
      expect(
        JSON.parse(Buffer.from(encoded ?? '', 'base64').toString())
      ).toEqual({
        client,
        mode: 'setup',
        base: 'https://wukongai.work',
        key,
        model,
      })
      const restore = buildWindowsTool(client, 'restore')
      const restorePayload = restore.match(/FromBase64String\('([^']+)'\)/)?.[1]
      expect(
        JSON.parse(Buffer.from(restorePayload ?? '', 'base64').toString())
      ).toEqual({ client, mode: 'restore' })
    }
  )

  it.each(['gpt-6.1-sol', 'grok-4', 'deepseek-v4-pro'])(
    'rejects %s for Claude before producing a customer download',
    (model) => {
      expect(isClientModelCompatible('claude', model)).toBe(false)
      expect(() =>
        buildWindowsTool('claude', 'setup', {
          base: 'https://wukongai.work',
          key: 'sk-test-only',
          model,
        })
      ).toThrow('ChatGPT / Codex')
    }
  )

  it('keeps valid Claude gateway routes and GPT models for Codex selectable', () => {
    for (const model of [
      'claude-sonnet-5-5',
      'anthropic/claude-opus-5-5',
      'bedrock/us.anthropic.claude-sonnet-4-6',
    ]) {
      expect(isClientModelCompatible('claude', model)).toBe(true)
      expect(
        buildWindowsTool('claude', 'setup', {
          base: 'https://wukongai.work',
          key: 'sk-test-only',
          model,
        })
      ).toContain('@echo off')
    }
    expect(isClientModelCompatible('codex', 'gpt-6.1-sol')).toBe(true)
  })

  it.runIf(process.platform === 'win32')(
    'stops an old incompatible Claude payload before installation or configuration',
    () => {
      const root = temporaryHome()
      const bat = buildWindowsTool('claude', 'setup', {
        base: 'https://wukongai.work',
        key: 'sk-test-only',
        model: 'claude-example',
      })
      const payload = bat.match(/FromBase64String\('([^']+)'\)/)?.[1]
      if (!payload) throw new Error('Missing payload')
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
      decoded.model = 'gpt-6.1-sol'
      const script = bat
        .split('# WUKONGAI_SCRIPT\r\n')[1]
        .replace(
          payload,
          Buffer.from(JSON.stringify(decoded)).toString('base64')
        )
        .replace(
          '# WUKONGAI_GRAPHICAL_MAIN',
          "function Install-GraphicalDesktop { throw 'MUST_NOT_INSTALL' }\n# WUKONGAI_GRAPHICAL_MAIN"
        )
      const file = path.join(root, 'incompatible.ps1')
      fs.writeFileSync(file, `\ufeff${script}`)
      const result = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
        { encoding: 'utf8', timeout: 30000, windowsHide: true }
      )
      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain('ChatGPT / Codex')
      expect(result.stdout + result.stderr).not.toContain('MUST_NOT_INSTALL')
      expect(result.stdout).not.toContain('sk-test-only')
    }
  )

  it.each(clients)(
    '%s preserves the first backup across repeated setup and restores original bytes',
    (client) => {
      const root = temporaryHome()
      const existing: Record<string, string> = {
        codex: 'config.toml',
        claude: 'settings.json',
        grok: 'config.toml',
        deepseek: 'cordis.patch.yml',
      }
      let original = '# original settings\n'
      if (client === 'claude') {
        original = '{"permissions":{"allow":["Read"]},"env":{"OTHER":"kept"}}\n'
      }
      if (client === 'deepseek') {
        original = '- id: existing-plugin\n  name: example\n'
      }
      fs.writeFileSync(path.join(root, existing[client]), original)
      const input = {
        client,
        mode: 'setup',
        base: 'https://wukongai.work',
        key: 'sk-fake-example',
        model: 'example-model',
      }
      expect(configure(input, root, dependencies)).toBe('configured')
      expect(
        configure({ ...input, key: 'sk-fake-second' }, root, dependencies)
      ).toBe('configured')
      expect(
        fs.readFileSync(
          path.join(root, '.wukongai-setup-backup', existing[client]),
          'utf8'
        )
      ).toBe(original)
      expect(configure({ client, mode: 'restore' }, root, dependencies)).toBe(
        'restored'
      )
      expect(fs.readFileSync(path.join(root, existing[client]), 'utf8')).toBe(
        original
      )
      if (client === 'codex') {
        expect(fs.existsSync(path.join(root, 'auth.json'))).toBe(false)
      }
      if (client === 'deepseek') {
        expect(fs.existsSync(path.join(root, '.credentials.yaml'))).toBe(false)
      }
      expect(configure({ client, mode: 'restore' }, root, dependencies)).toBe(
        'nothing-to-restore'
      )
    }
  )

  it('merges Claude permissions and writes the selected endpoint and model', () => {
    const root = temporaryHome()
    fs.writeFileSync(
      path.join(root, 'settings.json'),
      '{"permissions":{"allow":["Read"]},"env":{"OTHER":"kept"}}'
    )
    configure(
      {
        client: 'claude',
        mode: 'setup',
        base: 'https://wukongai.work',
        key: 'sk-fake',
        model: 'claude-example',
      },
      root,
      dependencies
    )
    const config = JSON.parse(
      fs.readFileSync(path.join(root, 'settings.json'), 'utf8')
    )
    expect(config.permissions).toEqual({ allow: ['Read'] })
    expect(config.env).toMatchObject({
      OTHER: 'kept',
      ANTHROPIC_BASE_URL: 'https://wukongai.work',
      ANTHROPIC_AUTH_TOKEN: 'sk-fake',
      ANTHROPIC_MODEL: 'claude-example',
    })
  })

  it.each(['codex', 'grok'] as WindowsClient[])(
    '%s writes parseable TOML without treating quotes in a model as code',
    (client) => {
      const root = temporaryHome()
      const model = 'model" with \\ characters'
      configure(
        {
          client,
          mode: 'setup',
          base: 'https://wukongai.work',
          key: 'sk-fake',
          model,
        },
        root,
        dependencies
      )
      const config = TOML.parse(
        fs.readFileSync(path.join(root, 'config.toml'), 'utf8')
      )
      if (client === 'codex') expect(config.model).toBe(model)
      else {
        expect(
          (config.model as Record<string, Record<string, string>>).wukongai
            .model
        ).toBe(model)
      }
    }
  )

  it('configures the DeepSeek custom provider and credentials independently', () => {
    const root = temporaryHome()
    configure(
      {
        client: 'deepseek',
        mode: 'setup',
        base: 'https://wukongai.work',
        key: 'sk-fake',
        model: 'deepseek-example',
      },
      root,
      dependencies
    )
    const patch = YAML.parse(
      fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')
    )
    expect(
      patch.find((entry: { id: string }) => entry.id === 'llm-pi-ai').config
        .providers.wukongai
    ).toMatchObject({
      baseURL: 'https://wukongai.work/v1',
      apiKeyEnv: 'WUKONGAI_API_KEY',
      api: 'openai-completions',
    })
    expect(
      patch.find((entry: { id: string }) => entry.id === 'agent-default-model')
        .config
    ).toEqual({ provider: 'wukongai', model: 'deepseek-example' })
    expect(
      YAML.parse(fs.readFileSync(path.join(root, '.credentials.yaml'), 'utf8'))
    ).toEqual({ WUKONGAI_API_KEY: 'sk-fake' })
  })

  it('refuses invalid existing files and insecure endpoints before altering configuration', () => {
    const root = temporaryHome()
    fs.writeFileSync(path.join(root, 'settings.json'), '{invalid')
    const input = {
      client: 'claude',
      mode: 'setup',
      base: 'https://wukongai.work',
      key: 'sk-fake',
      model: 'example',
    }
    expect(() => configure(input, root, dependencies)).toThrow()
    expect(fs.readFileSync(path.join(root, 'settings.json'), 'utf8')).toBe(
      '{invalid'
    )
    expect(() =>
      configure(
        { ...input, base: 'http://untrusted.example' },
        root,
        dependencies
      )
    ).toThrow()
    expect(fs.existsSync(path.join(root, '.wukongai-setup-backup'))).toBe(false)
  })

  it.runIf(process.platform === 'win32')(
    'restores through the complete PowerShell BAT runner',
    () => {
      const root = temporaryHome()
      const profile = path.join(root, '中文目录')
      const tools = path.join(root, 'WukongAi', 'setup-runtime')
      fs.mkdirSync(profile, { recursive: true })
      fs.mkdirSync(path.join(tools, 'node_modules', '@iarna'), {
        recursive: true,
      })
      fs.writeFileSync(path.join(tools, 'package.json'), '{}')
      for (const name of ['yaml', '@iarna/toml']) {
        fs.cpSync(
          path.join(dependencies, 'node_modules', name),
          path.join(tools, 'node_modules', name),
          { recursive: true, dereference: true }
        )
      }
      const original = '{"env":{"TEST":"原配置"}}'
      fs.writeFileSync(path.join(profile, 'settings.json'), original)
      configure(
        {
          client: 'claude',
          mode: 'setup',
          base: 'https://wukongai.work',
          key: 'sk-local-only',
          model: '示例',
        },
        profile,
        dependencies
      )
      const bat = path.join(root, 'restore.bat')
      fs.writeFileSync(bat, buildWindowsTool('claude', 'restore'))
      const result = spawnSync('cmd.exe', ['/d', '/s', '/c', `""${bat}""`], {
        windowsVerbatimArguments: true,
        input: '\r\n',
        encoding: 'utf8',
        timeout: 60000,
        env: {
          ...process.env,
          LOCALAPPDATA: root,
          CLAUDE_CONFIG_DIR: profile,
        },
      })
      expect(result.status, result.stdout + result.stderr).toBe(0)
      expect(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).toBe(
        original
      )
    }
  )

  it.runIf(process.platform === 'win32').each(clients)(
    '%s restore BAT runs in Windows without a backup and leaves user files untouched',
    (client) => {
      const root = temporaryHome()
      const bat = path.join(root, 'restore.bat')
      fs.writeFileSync(bat, buildWindowsTool(client, 'restore'))
      const result = spawnSync('cmd.exe', ['/d', '/s', '/c', `""${bat}""`], {
        windowsVerbatimArguments: true,
        input: '\r\n',
        encoding: 'utf8',
        timeout: 60000,
        env: {
          ...process.env,
          USERPROFILE: root,
          LOCALAPPDATA: root,
          CODEX_HOME: path.join(root, '.codex'),
          CLAUDE_CONFIG_DIR: path.join(root, '.claude'),
          GROK_HOME: path.join(root, '.grok'),
          DSH_HOME: path.join(root, '.dsh'),
        },
      })
      expect(result.status, result.stdout + result.stderr).toBe(0)
      expect(result.stdout).toContain('未修改任何配置')
      for (const folder of ['.codex', '.claude', '.grok', '.dsh']) {
        expect(fs.existsSync(path.join(root, folder))).toBe(false)
      }
    }
  )
})
