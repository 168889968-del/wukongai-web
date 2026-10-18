/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Download, KeyRound, Loader2, RotateCcw, Sparkles, Terminal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { CCSwitchDialog } from '@/features/keys/components/dialogs/cc-switch-dialog'
import type { ApiKey } from '@/features/keys/types'
import { getUserModels } from '@/lib/api'
import { getLobeIcon } from '@/lib/lobe-icon'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export type ClientType = 'codex' | 'claude' | 'grok' | 'deepseek' | 'gemini' | 'openai'
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
  { value: 'codex', label: 'ChatGPT', hint: 'Codex', icon: 'OpenAI', modelRequired: true },
  { value: 'claude', label: 'Claude', hint: 'Claude Code', icon: 'Claude.Color', modelRequired: false },
  { value: 'grok', label: 'Grok', hint: 'Grok Build', icon: 'Grok', modelRequired: true },
  { value: 'deepseek', label: 'DeepSeek', hint: 'DeepSeek Harness', icon: 'DeepSeek.Color', modelRequired: true },
]

const MORE_OPTIONS: ClientOption[] = [
  { value: 'gemini', label: 'Gemini CLI', hint: 'Google Gemini CLI', modelRequired: false },
  { value: 'openai', label: '通用接口', hint: 'Cherry Studio、ChatBox、Cursor 等', modelRequired: false },
]

const CLIENT_OPTIONS: ClientOption[] = [...PRIMARY_OPTIONS, ...MORE_OPTIONS]

const BACKUP_SUFFIX = '.wukongai.bak'

function getServerAddress(): string {
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

function buildFiles(
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
    return [{ dir: '.gemini', fileName: '.env', content: `${lines.join('\n')}\n` }]
  }
  return []
}

function buildInstallCommand(
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

function buildRestoreCommand(
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
    parts.push(`[Environment]::SetEnvironmentVariable('${API_KEY_ENV}', $null, 'User')`)
  }
  return `${parts.join('\n')}\nWrite-Host "已恢复原来的配置"\n`
}

/** Restore command for a client; needs no key because it only renames backups */
export function getRestoreCommand(client: ClientType, os: OsType): string {
  const files = buildFiles(client, 'https://example.invalid', 'placeholder', 'placeholder')
  if (files.length === 0) return ''
  return buildRestoreCommand(os, files, client === 'grok')
}

function downloadText(fileName: string, content: string) {
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

interface CodeBlockProps {
  title: string
  subtitle?: string
  content: string
  copyLabel: string
  onDownload?: () => void
}

function CodeBlock(props: CodeBlockProps) {
  const { t } = useTranslation()
  return (
    <div className='overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2 dark:bg-slate-900'>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{props.title}</p>
          {props.subtitle && (
            <p className='text-muted-foreground truncate text-xs'>{props.subtitle}</p>
          )}
        </div>
        <div className='flex items-center gap-1'>
          <CopyButton
            value={props.content}
            variant='ghost'
            size='sm'
            tooltip={t('复制')}
            successTooltip={t('已复制')}
            aria-label={props.copyLabel}
          />
          {props.onDownload && (
            <Button
              variant='ghost'
              size='sm'
              onClick={props.onDownload}
              aria-label={t('下载 {{name}}', { name: props.title })}
            >
              <Download className='size-4' />
            </Button>
          )}
        </div>
      </div>
      <pre className='max-h-56 overflow-auto bg-slate-950 px-4 py-3 text-xs leading-5 text-sky-100'>
        <code>{props.content}</code>
      </pre>
    </div>
  )
}

interface QuickSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClient?: ClientType
  initialOs?: OsType
}

export function QuickSetupDialog(props: QuickSetupDialogProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAuthenticated = !!user
  const [client, setClient] = useState<ClientType>('codex')
  const [os, setOs] = useState<OsType>(detectOs)
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null)
  const [model, setModel] = useState('')
  const [realKey, setRealKey] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [ccSwitchOpen, setCcSwitchOpen] = useState(false)
  const [showManual, setShowManual] = useState(false)

  const keysQuery = useQuery({
    queryKey: ['quick-setup-keys'],
    queryFn: async () => getApiKeys({ p: 1, size: 100 }),
    enabled: props.open && isAuthenticated,
    staleTime: 30 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['quick-setup-models'],
    queryFn: async () => getUserModels(),
    enabled: props.open && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const activeKeys = useMemo<ApiKey[]>(() => {
    const items = keysQuery.data?.data?.items ?? []
    return items.filter((item) => item.status === 1)
  }, [keysQuery.data])

  const modelOptions = useMemo(() => {
    const items = modelsQuery.data?.data ?? []
    return items.map((item) => ({ value: item, label: item }))
  }, [modelsQuery.data])

  useEffect(() => {
    if (!props.open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRealKey('')
    setModel('')
    setShowManual(false)
    if (props.initialClient) setClient(props.initialClient)
    if (props.initialOs) setOs(props.initialOs)
  }, [props.open, props.initialClient, props.initialOs])

  useEffect(() => {
    if (selectedKeyId === null && activeKeys.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedKeyId(activeKeys[0].id)
    }
  }, [activeKeys, selectedKeyId])

  const handleSelectKey = (id: number) => {
    setSelectedKeyId(id)
    setRealKey('')
  }

  const handleGenerate = async () => {
    if (selectedKeyId === null) return
    setRevealing(true)
    try {
      const res = await fetchTokenKey(selectedKeyId)
      if (!res.success || !res.data?.key) {
        handleServerError(res, t('获取密钥失败，请稍后重试'))
        return
      }
      const key = res.data.key
      setRealKey(key.startsWith('sk-') ? key : `sk-${key}`)
    } catch (error) {
      handleServerError(error, t('获取密钥失败，请稍后重试'))
    } finally {
      setRevealing(false)
    }
  }

  const serverAddress = getServerAddress()
  const currentClient =
    CLIENT_OPTIONS.find((option) => option.value === client) ?? CLIENT_OPTIONS[0]
  const files = realKey ? buildFiles(client, serverAddress, realKey, model) : []
  const needsModel = currentClient.modelRequired && !model
  const usesEnvKey = client === 'grok'
  const installCommand =
    files.length > 0 ? buildInstallCommand(os, files, usesEnvKey ? realKey : undefined) : ''
  const restoreCommand = files.length > 0 ? buildRestoreCommand(os, files, usesEnvKey) : ''
  const homePrefix = os === 'mac' ? '~' : '%USERPROFILE%'
  const terminalName = os === 'mac' ? t('终端') : 'PowerShell'

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('一键配置客户端')}
        description={t('选好客户端、密钥和模型，自动生成填好地址和密钥的配置。')}
        contentClassName='sm:max-w-2xl'
        bodyClassName='space-y-5'
      >
        {!isAuthenticated ? (
          <div className='rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center dark:border-sky-900 dark:bg-sky-950/30'>
            <KeyRound className='mx-auto size-8 text-sky-500' aria-hidden='true' />
            <p className='mt-3 font-medium'>{t('登录后即可一键生成配置')}</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('配置里会自动填入你的 API 密钥，所以需要先登录。')}
            </p>
            <div className='mt-4 flex justify-center gap-2'>
              <Button variant='outline' className='rounded-full' render={<Link to='/sign-in' />}>
                {t('登录')}
              </Button>
              <Button
                className='rounded-full bg-sky-500 text-white hover:bg-sky-600'
                render={<Link to='/sign-up' />}
              >
                {t('免费注册')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <section className='space-y-2.5'>
              <Label>{t('1. 你要用哪个模型？')}</Label>
              <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                {PRIMARY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={client === option.value}
                    onClick={() => setClient(option.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      client === option.value
                        ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)] dark:bg-sky-500/10'
                        : 'border-slate-200 hover:border-sky-300 dark:border-slate-700'
                    )}
                  >
                    <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'>
                      {getLobeIcon(option.icon, 24)}
                    </span>
                    <span className='min-w-0'>
                      <span className='block font-semibold'>{option.label}</span>
                      <span className='text-muted-foreground block text-xs'>
                        {t('使用 {{client}}', { client: option.hint })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className='flex flex-wrap items-center gap-2 text-xs'>
                <span className='text-muted-foreground'>{t('其他客户端：')}</span>
                {MORE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={client === option.value}
                    title={t(option.hint)}
                    onClick={() => setClient(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 transition',
                      client === option.value
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                        : 'border-slate-200 hover:border-sky-300 dark:border-slate-700'
                    )}
                  >
                    {t(option.label)}
                  </button>
                ))}
              </div>
            </section>

            <section className='space-y-2.5'>
              <Label>{t('2. 选择 API 密钥')}</Label>
              {keysQuery.isLoading && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Loader2 className='size-4 animate-spin' />
                  {t('正在读取你的密钥 ...')}
                </div>
              )}
              {!keysQuery.isLoading && activeKeys.length === 0 && (
                <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm'>
                  <span>{t('你还没有可用的密钥，先创建一个吧。')}</span>
                  <Button
                    size='sm'
                    className='rounded-full bg-sky-500 text-white hover:bg-sky-600'
                    render={<Link to='/keys' />}
                  >
                    {t('去创建密钥')}
                  </Button>
                </div>
              )}
              {!keysQuery.isLoading && activeKeys.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  {activeKeys.map((item) => (
                    <button
                      key={item.id}
                      type='button'
                      aria-pressed={selectedKeyId === item.id}
                      onClick={() => handleSelectKey(item.id)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm transition',
                        selectedKeyId === item.id
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                          : 'border-slate-200 hover:border-sky-300 dark:border-slate-700'
                      )}
                    >
                      {item.name || `#${item.id}`}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className='space-y-2.5'>
              <Label htmlFor='quick-setup-model'>
                {currentClient.modelRequired
                  ? t('3. 选择模型（必填）')
                  : t('3. 选择模型（可选，不填则用客户端默认）')}
              </Label>
              <Combobox
                id='quick-setup-model'
                aria-label={t('模型')}
                options={modelOptions}
                value={model}
                onValueChange={(value) => setModel(value ?? '')}
                placeholder={t('选择或输入模型名称，例如 Grok、DeepSeek 等')}
                emptyText={t('没有找到模型')}
              />
            </section>

            {!realKey ? (
              <Button
                className='h-11 w-full rounded-full bg-sky-500 text-base font-semibold text-white hover:bg-sky-600'
                disabled={selectedKeyId === null || revealing}
                onClick={handleGenerate}
              >
                {revealing ? (
                  <Loader2 className='mr-2 size-4 animate-spin' />
                ) : (
                  <Sparkles className='mr-2 size-4' />
                )}
                {t('生成配置')}
              </Button>
            ) : (
              <section className='space-y-3'>
                {needsModel && (
                  <p className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
                    {t('这个客户端需要指定模型，请先在上面选择模型，配置会自动更新。')}
                  </p>
                )}

                {client === 'deepseek' && (
                  <div className='space-y-2'>
                    <CodeBlock
                      title={t('第一步：安装并打开 DeepSeek Harness')}
                      subtitle={t('需要 Node.js 22.19 或更高版本')}
                      content={'npx @deepseek-ai/dsh web\n'}
                      copyLabel={t('复制安装命令')}
                    />
                    <p className='text-muted-foreground text-sm'>
                      {t('第二步：在打开的页面进入「Settings → Models → Add a custom provider」，填入下面几项：')}
                    </p>
                  </div>
                )}

                {client === 'openai' || client === 'deepseek' ? (
                  <div className='space-y-2'>
                    {client === 'openai' && (
                      <p className='text-muted-foreground text-sm'>
                        {t('在客户端里添加「OpenAI 兼容」服务商，填入下面三项即可：')}
                      </p>
                    )}
                    {[
                      ...(client === 'deepseek'
                        ? [
                            { label: t('服务商 ID（Provider id）'), value: 'wukongai' },
                            { label: t('协议（Protocol）'), value: 'openai-completions' },
                          ]
                        : []),
                      { label: t('接口地址（API Base URL）'), value: `${serverAddress}/v1` },
                      { label: t('API 密钥'), value: realKey },
                      { label: t('模型'), value: model || t('（在客户端里选择）') },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className='flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700'
                      >
                        <div className='min-w-0'>
                          <p className='text-muted-foreground text-xs'>{field.label}</p>
                          <p className='truncate font-mono text-sm'>{field.value}</p>
                        </div>
                        <CopyButton
                          value={field.value}
                          variant='ghost'
                          size='sm'
                          tooltip={t('复制')}
                          successTooltip={t('已复制')}
                          aria-label={t('复制 {{name}}', { name: field.label })}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <p className='flex items-center gap-1.5 text-sm font-medium'>
                        <Terminal className='size-4 text-sky-500' aria-hidden='true' />
                        {t('复制命令，粘贴到{{terminal}}里运行', { terminal: terminalName })}
                      </p>
                      <div className='inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800'>
                        {(
                          [
                            { value: 'windows', label: 'Windows' },
                            { value: 'mac', label: 'Mac / Linux' },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.value}
                            type='button'
                            aria-pressed={os === option.value}
                            onClick={() => setOs(option.value)}
                            className={cn(
                              'rounded-full px-3 py-1 text-xs font-medium transition',
                              os === option.value
                                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <CodeBlock
                      title={t('一键写入配置')}
                      subtitle={t('会先把你原来的配置备份成 {{suffix}} 文件', {
                        suffix: BACKUP_SUFFIX,
                      })}
                      content={installCommand}
                      copyLabel={t('复制配置命令')}
                    />
                    <details className='group rounded-2xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700'>
                      <summary className='flex cursor-pointer list-none items-center gap-1.5 font-medium'>
                        <RotateCcw className='size-4 text-slate-500' aria-hidden='true' />
                        {t('想换回原来的配置？')}
                      </summary>
                      <div className='mt-3'>
                        <CodeBlock
                          title={t('恢复原配置')}
                          content={restoreCommand}
                          copyLabel={t('复制恢复命令')}
                        />
                      </div>
                    </details>
                    <button
                      type='button'
                      onClick={() => setShowManual((value) => !value)}
                      className='text-sm font-medium text-sky-600 hover:text-sky-700'
                    >
                      {showManual ? t('收起配置文件') : t('不想用命令？查看配置文件，手动保存')}
                    </button>
                    {showManual &&
                      files.map((file) => (
                        <CodeBlock
                          key={file.fileName}
                          title={file.fileName}
                          subtitle={t('保存到 {{path}}', {
                            path: `${homePrefix}/${file.dir}/${file.fileName}`,
                          })}
                          content={file.content}
                          copyLabel={t('复制 {{name}}', { name: file.fileName })}
                          onDownload={() => downloadText(file.fileName, file.content)}
                        />
                      ))}
                  </>
                )}

                <p className='text-muted-foreground text-xs leading-5'>
                  {t('配置完成后重启客户端即可使用。配置里含有你的密钥，请不要发给别人。')}
                </p>

                {(client === 'codex' || client === 'claude' || client === 'gemini') && (
                  <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30'>
                    <span className='text-sm'>
                      {t('装了 CC Switch？可以直接导入，不用运行命令。')}
                    </span>
                    <Button
                      size='sm'
                      variant='outline'
                      className='rounded-full'
                      onClick={() => setCcSwitchOpen(true)}
                    >
                      {t('用 CC Switch 导入')}
                    </Button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </Dialog>
      {realKey && (
        <CCSwitchDialog open={ccSwitchOpen} onOpenChange={setCcSwitchOpen} tokenKey={realKey} />
      )}
    </>
  )
}
