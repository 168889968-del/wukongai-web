import configurationWorker from './windows-config.mjs?raw'
import windowsRunner from './windows-runner.ps1?raw'

export type WindowsClient = 'codex' | 'claude' | 'grok' | 'deepseek'

export function isWindowsClient(client: string): client is WindowsClient {
  return ['codex', 'claude', 'grok', 'deepseek'].includes(client)
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function buildWindowsTool(
  client: WindowsClient,
  mode: 'setup' | 'restore' | 'install',
  config?: { base: string; key: string; model: string }
): string {
  if (mode === 'setup' && (!config?.base || !config.key || !config.model)) {
    throw new Error('Select a key and model before downloading')
  }
  const payload =
    mode === 'setup' ? { client, mode, ...config } : { client, mode }
  const script = windowsRunner
    .replace('__PAYLOAD__', encode(JSON.stringify(payload)))
    .replace('__WORKER__', encode(configurationWorker))
  return [
    '@echo off',
    'setlocal',
    'chcp 65001 >nul',
    'set "WUKONGAI_SETUP_FILE=%~f0"',
    'powershell.exe -NoProfile -Command "$raw=[IO.File]::ReadAllText($env:WUKONGAI_SETUP_FILE);$parts=$raw -split \'(?m)^# WUKONGAI_SCRIPT\\r?$\',2;& ([scriptblock]::Create($parts[1]))"',
    'set "WUKONGAI_EXIT=%ERRORLEVEL%"',
    'echo.',
    'pause',
    'exit /b %WUKONGAI_EXIT%',
    '# WUKONGAI_SCRIPT',
    script,
  ].join('\r\n')
}

export function downloadWindowsTool(
  client: WindowsClient,
  mode: 'setup' | 'restore' | 'install',
  config?: { base: string; key: string; model: string }
): string {
  const fileName = `wukongai-${client}-${mode}.bat`
  const blob = new Blob([buildWindowsTool(client, mode, config)], {
    type: 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return fileName
}
