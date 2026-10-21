import macRunner from './mac-runner.sh?raw'

export type MacClient = 'codex' | 'claude'
type MacMode = 'setup' | 'install' | 'restore'

export function isMacClient(client: string): client is MacClient {
  return client === 'codex' || client === 'claude'
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
const xml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function buildMacTool(
  client: MacClient,
  mode: MacMode,
  config?: { base: string; key: string; model: string }
): string {
  if (mode === 'setup') {
    if (!config?.key || !config.model || !config.base.startsWith('https://')) {
      throw new Error('Select a key and model before downloading')
    }
    if (
      Object.values(config).some((value) =>
        [...value].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        )
      )
    ) {
      throw new Error('Invalid setup input')
    }
    if (
      client === 'claude' &&
      !/(^|[/.])(claude[-.]|anthropic[/.])/i.test(config.model)
    ) {
      throw new Error('Claude Desktop only supports Claude models')
    }
  }
  const base = config?.base.replace(/\/+$/, '') ?? ''
  const toml = config
    ? `model_provider = "wukongai"\nmodel = ${JSON.stringify(config.model)}\n\n[model_providers.wukongai]\nname = "WukongAi"\nbase_url = ${JSON.stringify(`${base}/v1`)}\nwire_api = "responses"\nrequires_openai_auth = true\n`
    : ''
  const auth = JSON.stringify({ OPENAI_API_KEY: config?.key })
  const policy = Object.entries({
    inferenceProvider: 'gateway',
    inferenceCredentialKind: 'static',
    inferenceGatewayBaseUrl: base,
    inferenceGatewayApiKey: config?.key ?? '',
    inferenceGatewayAuthScheme: 'bearer',
    inferenceModels: JSON.stringify([{ name: config?.model ?? '' }]),
    deploymentDisplayName: '悟空Ai',
  })
    .map(([key, value]) => `<key>${key}</key><string>${xml(value)}</string>`)
    .join('\n')
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${policy}</dict></plist>\n`
  const header = [
    '#!/bin/bash',
    `client=${quote(client)}`,
    `mode=${quote(mode)}`,
    `gateway=${quote(base)}`,
    `api_key=${quote(config?.key ?? '')}`,
    `selected_model=${quote(config?.model ?? '')}`,
    `codex_config=${quote(toml)}`,
    `codex_auth=${quote(auth)}`,
    `claude_policy=${quote(plist)}`,
  ].join('\n')
  return `${header}\n${macRunner.replaceAll('\r\n', '\n')}`
}

export function downloadMacTool(
  client: MacClient,
  mode: MacMode,
  config?: { base: string; key: string; model: string }
): string {
  const name = `wukongai-${client}-${mode}.command`
  const url = URL.createObjectURL(
    new Blob([buildMacTool(client, mode, config)], {
      type: 'application/octet-stream',
    })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}
