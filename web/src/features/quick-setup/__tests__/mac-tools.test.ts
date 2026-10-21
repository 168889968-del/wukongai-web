import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildFiles,
  buildInstallCommand,
  getRestoreCommand,
} from '../configuration'
import { buildMacTool } from '../mac-tools'

const config = {
  base: 'https://example.invalid',
  key: 'sk-test-only',
  model: 'gpt-test',
}

describe('Mac desktop tools', () => {
  it('generates Mac installers and restore tools without requiring a key', () => {
    for (const client of ['codex', 'claude'] as const) {
      for (const mode of ['install', 'restore'] as const) {
        const script = buildMacTool(client, mode)
        expect(script.startsWith('#!/bin/bash\n')).toBe(true)
        expect(script).toContain('Darwin')
        expect(script).not.toContain('powershell.exe')
      }
    }
  })
  it('routes existing Mac command and restore entrypoints to the desktop runner', () => {
    expect(
      buildInstallCommand(
        'mac',
        buildFiles('codex', config.base, config.key, config.model)
      )
    ).toBe(buildMacTool('codex', 'setup', config))
    expect(getRestoreCommand('codex', 'mac')).toBe(
      buildMacTool('codex', 'restore')
    )
    const claude = { ...config, model: 'claude-test' }
    expect(
      buildInstallCommand(
        'mac',
        buildFiles('claude', claude.base, claude.key, claude.model)
      )
    ).toBe(buildMacTool('claude', 'setup', claude))
  })
  it('rejects missing keys, unsafe input and non-Claude models before a download', () => {
    expect(() => buildMacTool('codex', 'setup')).toThrow()
    expect(() =>
      buildMacTool('codex', 'setup', { ...config, key: 'bad\nkey' })
    ).toThrow()
    expect(() => buildMacTool('claude', 'setup', config)).toThrow(
      'Claude models'
    )
  })
  it('quotes shell input and XML policy values without injecting commands', () => {
    const script = buildMacTool('claude', 'setup', {
      ...config,
      model: 'claude-test',
      key: "a'$(touch /tmp/unwanted)<&",
    })
    expect(script).toContain("api_key='a'\\''$(touch /tmp/unwanted)<&'")
    expect(script).toContain('&lt;&amp;')
    expect(script).toContain('com.anthropic.claudefordesktop.plist')
  })
  it('exports dummy-key fixtures for bash lifecycle verification when requested', () => {
    const output = process.env.WUKONGAI_MAC_FIXTURES
    if (!output) return
    fs.mkdirSync(output, { recursive: true })
    for (const client of ['codex', 'claude'] as const) {
      for (const mode of ['setup', 'restore', 'install'] as const) {
        const script = buildMacTool(
          client,
          mode,
          mode === 'setup'
            ? {
                ...config,
                model: client === 'claude' ? 'claude-test' : config.model,
              }
            : undefined
        )
        fs.writeFileSync(path.join(output, `${client}-${mode}.sh`), script)
      }
    }
  })
})
