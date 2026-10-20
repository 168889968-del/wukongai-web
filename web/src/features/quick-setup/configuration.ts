export type ClientType =
  | 'codex'
  | 'claude'
  | 'grok'
  | 'deepseek'
  | 'gemini'
  | 'openai'
export type OsType = 'windows' | 'mac'

const API_KEY_ENV = 'WUKONGAI_API_KEY'

interface ConfigFile {
  /** Folder under the user's home directory, e.g. ".codex" */
  dir: string
  fileName: string
  content: string
}

export interface ClientOption {
  value: ClientType
  label: string
  hint: string
  icon?: string
  modelRequired: boolean
}

/** The four model families shown first, each with its official client */
export const PRIMARY_OPTIONS: ClientOption[] = [
  {
    value: 'codex',
    label: 'ChatGPT',
    hint: 'Codex',
    icon: 'OpenAI',
    modelRequired: true,
  },
  {
    value: 'claude',
    label: 'Claude',
    hint: 'Claude 桌面版',
    icon: 'Claude.Color',
    modelRequired: true,
  },
  {
    value: 'grok',
    label: 'Grok',
    hint: 'Grok Build Desktop（社区版）',
    icon: 'Grok',
    modelRequired: true,
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    hint: 'DeepSeek Harness 桌面版',
    icon: 'DeepSeek.Color',
    modelRequired: true,
  },
]

export const MORE_OPTIONS: ClientOption[] = [
  {
    value: 'openai',
    label: '通用接口',
    hint: 'Cherry Studio、ChatBox、Cursor 等',
    modelRequired: false,
  },
]

export const CLIENT_OPTIONS: ClientOption[] = [
  ...PRIMARY_OPTIONS,
  ...MORE_OPTIONS,
]

export const BACKUP_SUFFIX = '.wukongai.bak'

export function isClientModelCompatible(
  client: ClientType,
  model: string
): boolean {
  // Claude Desktop rejects non-Anthropic models before showing its model picker.
  return (
    client !== 'claude' || /(^|[/.])(claude[-.]|anthropic[/.])/i.test(model)
  )
}

export function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (typeof status.server_address === 'string' && status.server_address) {
        return status.server_address.replace(/\/+$/, '')
      }
    }
  } catch {
    /* fall back to the current origin */
  }
  return window.location.origin
}

export function buildFiles(
  client: ClientType,
  base: string,
  key: string,
  model: string
): ConfigFile[] {
  if (client === 'codex') {
    const toml = [
      'model_provider = "wukongai"',
      `model = "${model}"`,
      'model_reasoning_effort = "high"',
      '',
      '[model_providers.wukongai]',
      'name = "WukongAi"',
      `base_url = "${base}/v1"`,
      'wire_api = "responses"',
      'requires_openai_auth = true',
      '',
    ].join('\n')
    return [
      { dir: '.codex', fileName: 'config.toml', content: toml },
      {
        dir: '.codex',
        fileName: 'auth.json',
        content: `${JSON.stringify({ OPENAI_API_KEY: key }, null, 2)}\n`,
      },
    ]
  }
  if (client === 'claude') {
    const env: Record<string, string> = {
      ANTHROPIC_BASE_URL: base,
      ANTHROPIC_AUTH_TOKEN: key,
    }
    if (model) env.ANTHROPIC_MODEL = model
    return [
      {
        dir: '.claude',
        fileName: 'settings.json',
        content: `${JSON.stringify({ env }, null, 2)}\n`,
      },
    ]
  }
  if (client === 'grok') {
    const toml = [
      '[models]',
      'default = "wukongai"',
      '',
      '[model.wukongai]',
      `model = "${model}"`,
      `base_url = "${base}/v1"`,
      `env_key = "${API_KEY_ENV}"`,
      'name = "WukongAi"',
      '',
    ].join('\n')
    return [{ dir: '.grok', fileName: 'config.toml', content: toml }]
  }
  if (client === 'gemini') {
    const lines = [`GOOGLE_GEMINI_BASE_URL=${base}`, `GEMINI_API_KEY=${key}`]
    if (model) lines.push(`GEMINI_MODEL=${model}`)
    return [
      { dir: '.gemini', fileName: '.env', content: `${lines.join('\n')}\n` },
    ]
  }
  return []
}

export function buildInstallCommand(
  os: OsType,
  files: ConfigFile[],
  apiKeyEnv?: string
): string {
  if (os === 'mac') {
    const parts = files.map((file) => {
      const path = `~/${file.dir}/${file.fileName}`
      return [
        `mkdir -p ~/${file.dir}`,
        `[ -f ${path} ] && cp ${path} ${path}${BACKUP_SUFFIX}`,
        `cat > ${path} <<'WUKONGAI_EOF'`,
        `${file.content}WUKONGAI_EOF`,
      ].join('\n')
    })
    if (apiKeyEnv) {
      parts.push(
        [
          'for rc in ~/.zshrc ~/.bashrc; do',
          '  touch "$rc"',
          `  grep -v '^export ${API_KEY_ENV}=' "$rc" > "$rc.wk.tmp"; mv "$rc.wk.tmp" "$rc"`,
          `  echo 'export ${API_KEY_ENV}="${apiKeyEnv}"' >> "$rc"`,
          'done',
          `export ${API_KEY_ENV}="${apiKeyEnv}"`,
        ].join('\n')
      )
    }
    return `${parts.join('\n')}\necho "配置完成，请重新打开终端后再启动客户端"\n`
  }
  const winParts = files.map((file) =>
    [
      `$d = Join-Path $env:USERPROFILE '${file.dir}'`,
      'New-Item -ItemType Directory -Force -Path $d | Out-Null',
      `$f = Join-Path $d '${file.fileName}'`,
      `if (Test-Path $f) { Copy-Item $f "$f${BACKUP_SUFFIX}" -Force }`,
      "[IO.File]::WriteAllText($f, @'",
      `${file.content}'@)`,
    ].join('\n')
  )
  if (apiKeyEnv) {
    winParts.push(
      `[Environment]::SetEnvironmentVariable('${API_KEY_ENV}', '${apiKeyEnv}', 'User')`
    )
  }
  return `${winParts.join('\n')}\nWrite-Host "配置完成，请重新打开终端后再启动客户端"\n`
}

export function buildRestoreCommand(
  os: OsType,
  files: ConfigFile[],
  removeEnv = false
): string {
  if (os === 'mac') {
    const parts = files.map((file) => {
      const path = `~/${file.dir}/${file.fileName}`
      return `[ -f ${path}${BACKUP_SUFFIX} ] && mv ${path}${BACKUP_SUFFIX} ${path}`
    })
    if (removeEnv) {
      parts.push(
        `for rc in ~/.zshrc ~/.bashrc; do [ -f "$rc" ] && grep -v '^export ${API_KEY_ENV}=' "$rc" > "$rc.wk.tmp" && mv "$rc.wk.tmp" "$rc"; done`
      )
    }
    return `${parts.join('\n')}\necho "已恢复原来的配置"\n`
  }
  const parts = files.map((file) =>
    [
      `$f = Join-Path (Join-Path $env:USERPROFILE '${file.dir}') '${file.fileName}'`,
      `if (Test-Path "$f${BACKUP_SUFFIX}") { Move-Item "$f${BACKUP_SUFFIX}" $f -Force }`,
    ].join('\n')
  )
  if (removeEnv) {
    parts.push(
      `[Environment]::SetEnvironmentVariable('${API_KEY_ENV}', $null, 'User')`
    )
  }
  return `${parts.join('\n')}\nWrite-Host "已恢复原来的配置"\n`
}

/** Restore command for a client; needs no key because it only renames backups */
export function getRestoreCommand(client: ClientType, os: OsType): string {
  const files = buildFiles(
    client,
    'https://example.invalid',
    'placeholder',
    'placeholder'
  )
  if (files.length === 0) return ''
  return buildRestoreCommand(os, files, client === 'grok')
}

export function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function detectOs(): OsType {
  if (typeof navigator === 'undefined') return 'windows'
  return /Mac|iPhone|iPad|Linux/i.test(navigator.userAgent) ? 'mac' : 'windows'
}
