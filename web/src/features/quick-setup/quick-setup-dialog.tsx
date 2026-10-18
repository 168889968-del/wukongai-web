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
import { Download, KeyRound, Loader2, Sparkles } from 'lucide-react'
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
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type ClientType = 'codex' | 'claude'

interface ConfigFile {
  fileName: string
  location: string
  content: string
}

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

function buildCodexFiles(base: string, key: string, model: string): ConfigFile[] {
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
  const auth = `${JSON.stringify({ OPENAI_API_KEY: key }, null, 2)}\n`
  return [
    { fileName: 'config.toml', location: '~/.codex/config.toml', content: toml },
    { fileName: 'auth.json', location: '~/.codex/auth.json', content: auth },
  ]
}

function buildClaudeFiles(base: string, key: string, model: string): ConfigFile[] {
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: base,
    ANTHROPIC_AUTH_TOKEN: key,
  }
  if (model) env.ANTHROPIC_MODEL = model
  const settings = `${JSON.stringify({ env }, null, 2)}\n`
  return [
    {
      fileName: 'settings.json',
      location: '~/.claude/settings.json',
      content: settings,
    },
  ]
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

interface QuickSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickSetupDialog(props: QuickSetupDialogProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAuthenticated = !!user
  const [client, setClient] = useState<ClientType>('codex')
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null)
  const [model, setModel] = useState('')
  const [realKey, setRealKey] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [ccSwitchOpen, setCcSwitchOpen] = useState(false)

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
  }, [props.open])

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
  let files: ConfigFile[] = []
  if (realKey && client === 'codex') {
    files = buildCodexFiles(serverAddress, realKey, model)
  } else if (realKey) {
    files = buildClaudeFiles(serverAddress, realKey, model)
  }
  const needsModel = client === 'codex' && !model

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('一键配置客户端')}
        description={t('选好密钥和客户端，自动生成填好地址和密钥的配置文件。')}
        contentClassName='sm:max-w-2xl'
        bodyClassName='space-y-5'
      >
        {!isAuthenticated ? (
          <div className='rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center'>
            <KeyRound className='mx-auto size-8 text-sky-500' aria-hidden='true' />
            <p className='mt-3 font-medium'>{t('登录后即可一键生成配置')}</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('配置里会自动填入你的 API 密钥，所以需要先登录。')}
            </p>
            <div className='mt-4 flex justify-center gap-2'>
              <Button
                variant='outline'
                className='rounded-full'
                render={<Link to='/sign-in' />}
              >
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
              <Label>{t('1. 选择客户端')}</Label>
              <div className='grid grid-cols-2 gap-2.5'>
                {(
                  [
                    { value: 'codex', label: 'Codex', hint: 'OpenAI Codex CLI' },
                    { value: 'claude', label: 'Claude Code', hint: 'Anthropic Claude Code' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={client === option.value}
                    onClick={() => setClient(option.value)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition',
                      client === option.value
                        ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)] dark:bg-sky-500/10'
                        : 'border-slate-200 hover:border-sky-300'
                    )}
                  >
                    <span className='block font-semibold'>{option.label}</span>
                    <span className='text-muted-foreground block text-xs'>
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className='space-y-2.5'>
              <Label>{t('2. 选择 API 密钥')}</Label>
              {keysQuery.isLoading ? (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Loader2 className='size-4 animate-spin' />
                  {t('正在读取你的密钥 ...')}
                </div>
              ) : activeKeys.length === 0 ? (
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
              ) : (
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
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10'
                          : 'border-slate-200 hover:border-sky-300'
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
                {client === 'codex'
                  ? t('3. 选择模型（必填）')
                  : t('3. 选择模型（可选，不填则用客户端默认）')}
              </Label>
              <Combobox
                id='quick-setup-model'
                aria-label={t('模型')}
                options={modelOptions}
                value={model}
                onValueChange={(value) => setModel(value ?? '')}
                placeholder={t('选择或输入模型名称')}
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
                    {t('Codex 需要指定模型，请先在上面选择模型，配置会自动更新。')}
                  </p>
                )}
                {files.map((file) => (
                  <div
                    key={file.fileName}
                    className='overflow-hidden rounded-2xl border border-slate-200'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2 dark:bg-slate-900'>
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold'>{file.fileName}</p>
                        <p className='text-muted-foreground truncate text-xs'>
                          {t('保存到 {{path}}', { path: file.location })}
                        </p>
                      </div>
                      <div className='flex items-center gap-1'>
                        <CopyButton
                          value={file.content}
                          variant='ghost'
                          size='sm'
                          tooltip={t('复制')}
                          successTooltip={t('已复制')}
                          aria-label={t('复制 {{name}}', { name: file.fileName })}
                        />
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => downloadText(file.fileName, file.content)}
                          aria-label={t('下载 {{name}}', { name: file.fileName })}
                        >
                          <Download className='size-4' />
                        </Button>
                      </div>
                    </div>
                    <pre className='max-h-56 overflow-auto bg-slate-950 px-4 py-3 text-xs leading-5 text-sky-100'>
                      <code>{file.content}</code>
                    </pre>
                  </div>
                ))}
                <p className='text-muted-foreground text-xs leading-5'>
                  {t(
                    '保存后重启客户端即可使用。Windows 上 ~ 指的是 C:\\Users\\你的用户名。配置里含有你的密钥，请不要发给别人。'
                  )}
                </p>
                <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3'>
                  <span className='text-sm'>
                    {t('装了 CC Switch？可以直接导入，不用手动保存文件。')}
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
              </section>
            )}
          </>
        )}
      </Dialog>
      {realKey && (
        <CCSwitchDialog
          open={ccSwitchOpen}
          onOpenChange={setCcSwitchOpen}
          tokenKey={realKey}
        />
      )}
    </>
  )
}
