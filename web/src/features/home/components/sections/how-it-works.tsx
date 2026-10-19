import { Link } from '@tanstack/react-router'
import { Download, RotateCcw, Terminal } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  PRIMARY_OPTIONS,
  detectOs,
  getRestoreCommand,
  type ClientType,
  type OsType,
} from '@/features/quick-setup/configuration'
import {
  downloadWindowsTool,
  isWindowsClient,
} from '@/features/quick-setup/windows-tools'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const QuickSetupDialog = lazy(() =>
  import('@/features/quick-setup/quick-setup-dialog').then((module) => ({
    default: module.QuickSetupDialog,
  }))
)

/** Official install commands for each client */
const INSTALL_COMMANDS: Record<string, Record<OsType, string>> = {
  codex: {
    windows: 'npm install -g @openai/codex',
    mac: 'npm install -g @openai/codex',
  },
  claude: {
    windows: 'npm install -g @anthropic-ai/claude-code',
    mac: 'npm install -g @anthropic-ai/claude-code',
  },
  grok: {
    windows: 'irm https://x.ai/cli/install.ps1 | iex',
    mac: 'curl -fsSL https://x.ai/cli/install.sh | bash',
  },
  deepseek: {
    windows: 'npx @deepseek-ai/dsh web',
    mac: 'npx @deepseek-ai/dsh web',
  },
}

const OS_OPTIONS: { value: OsType; label: string }[] = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'Mac / Linux' },
]

export function HowItWorks() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const [client, setClient] = useState<ClientType>('codex')
  const [os, setOs] = useState<OsType>(detectOs)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showRestore, setShowRestore] = useState(false)

  const current =
    PRIMARY_OPTIONS.find((option) => option.value === client) ??
    PRIMARY_OPTIONS[0]
  const restoreCommand = getRestoreCommand(client, os)
  const installCommand = INSTALL_COMMANDS[client]?.[os] ?? ''
  const terminalName = os === 'mac' ? '终端' : 'PowerShell'
  const windowsTool = os === 'windows' && isWindowsClient(client)
  let restoreDescription = `${current.hint} 的服务商是在它自己的设置页面里添加的，删掉悟空Ai这一项即可。`
  if (restoreCommand) {
    restoreDescription = `把 ${current.hint} 恢复成接入前的设置，不影响你的账号和历史会话。`
  }
  let restoreLabel = showRestore ? t('收起恢复命令') : t('查看恢复命令')
  if (windowsTool) {
    restoreDescription = t(
      'Download the restore BAT file to recover your configuration from before connecting to WukongAi.'
    )
    restoreLabel = t('Download official restore tool')
  }
  const endpoint =
    typeof window === 'undefined' ? '/v1' : `${window.location.origin}/v1`

  return (
    <section
      id='quick-setup'
      className='scroll-mt-24 px-5 py-6 sm:px-8 md:py-8'
    >
      <div className='mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_8px_36px_-32px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-950'>
        <div className='flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/60 px-5 py-5 sm:px-7 dark:border-slate-800 dark:from-sky-950/30 dark:via-slate-950 dark:to-indigo-950/30'>
          <div>
            <p className='text-sm font-semibold text-sky-500'>一键接入</p>
            <h2 className='mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.75rem] dark:text-white'>
              {windowsTool
                ? t('Download the tool and connect to WukongAi')
                : t('装好客户端，一条命令接入悟空Ai')}
            </h2>
            <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
              {windowsTool
                ? t(
                    'Choose your client, download the BAT file, and double-click to get started.'
                  )
                : t('选好模型和电脑系统，复制命令粘贴运行，重启客户端就能用。')}
            </p>
          </div>
          <div
            className='inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'
            aria-label='选择电脑系统'
          >
            {OS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                aria-pressed={os === option.value}
                onClick={() => setOs(option.value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  os === option.value
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className='space-y-5 px-5 py-5 sm:px-7 sm:py-6'>
          <div
            className='grid grid-cols-2 gap-2.5 md:grid-cols-4'
            role='group'
            aria-label='选择模型'
          >
            {PRIMARY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                aria-pressed={client === option.value}
                onClick={() => {
                  setClient(option.value)
                  setShowRestore(false)
                }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
                  client === option.value
                    ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)] dark:bg-sky-500/10'
                    : 'border-slate-200 hover:border-sky-300 dark:border-slate-700'
                )}
              >
                <span className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'>
                  {getLobeIcon(option.icon, 22)}
                </span>
                <span className='min-w-0'>
                  <span className='block text-sm font-semibold text-slate-950 dark:text-white'>
                    {option.label}
                  </span>
                  <span className='block truncate text-xs text-slate-500'>
                    {option.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className='grid gap-3 md:grid-cols-[1.25fr_1fr]'>
            <article className='flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 p-5 text-white'>
              <div>
                <h3 className='text-lg font-semibold'>接入悟空Ai</h3>
                <p className='mt-1 text-sm leading-6 text-sky-50'>
                  {windowsTool
                    ? t(
                        'The tool installs {{client}} if needed, saves your configuration, and opens the client after setup.',
                        { client: current.hint }
                      )
                    : t(
                        '选好密钥和模型，自动生成 {{client}} 的配置命令，粘贴到{{terminal}}运行即可。原来的配置会先自动备份。',
                        { client: current.hint, terminal: terminalName }
                      )}
                </p>
              </div>
              <div>
                {isAuthenticated ? (
                  <Button
                    className='h-10 rounded-full bg-white px-5 font-semibold text-sky-600 hover:bg-sky-50'
                    onClick={() => setDialogOpen(true)}
                  >
                    <Download className='mr-1.5 size-4' />
                    {windowsTool ? t('Download setup tool') : t('生成配置命令')}
                  </Button>
                ) : (
                  <Button
                    className='h-10 rounded-full bg-white px-5 font-semibold text-sky-600 hover:bg-sky-50'
                    render={<Link to='/sign-in' />}
                  >
                    {windowsTool
                      ? t('Sign in to download setup tool')
                      : t('登录后生成配置')}
                  </Button>
                )}
              </div>
            </article>

            <article className='flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-700'>
              <div>
                <h3 className='text-lg font-semibold text-slate-950 dark:text-white'>
                  {t('Switch back to official')}
                </h3>
                <p className='mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400'>
                  {restoreDescription}
                </p>
              </div>
              {(restoreCommand || windowsTool) && (
                <div>
                  <Button
                    variant='outline'
                    className='h-10 rounded-full'
                    aria-expanded={windowsTool ? undefined : showRestore}
                    onClick={() => {
                      if (windowsTool && isWindowsClient(client)) {
                        downloadWindowsTool(client, 'restore')
                      } else setShowRestore((value) => !value)
                    }}
                  >
                    <RotateCcw className='mr-1.5 size-4' />
                    {restoreLabel}
                  </Button>
                  {showRestore && !windowsTool && (
                    <div className='mt-3 flex items-start gap-2 rounded-xl bg-slate-950 p-3'>
                      <pre className='min-w-0 flex-1 overflow-x-auto text-xs leading-5 text-sky-100'>
                        <code>{restoreCommand}</code>
                      </pre>
                      <CopyButton
                        value={restoreCommand}
                        variant='ghost'
                        size='sm'
                        tooltip='复制'
                        successTooltip='已复制'
                        aria-label='复制恢复命令'
                      />
                    </div>
                  )}
                </div>
              )}
            </article>
          </div>

          {installCommand && !windowsTool && (
            <div className='flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700'>
              <span className='flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400'>
                <Terminal className='size-4 text-sky-500' aria-hidden='true' />
                还没装 {current.hint}？在{terminalName}里运行：
              </span>
              <code className='min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200'>
                {installCommand}
              </code>
              <CopyButton
                value={installCommand}
                variant='ghost'
                size='sm'
                tooltip='复制'
                successTooltip='已复制'
                aria-label='复制安装命令'
              />
              <Link
                to='/get-started'
                className='shrink-0 text-sm font-medium text-sky-600 hover:text-sky-700'
              >
                跟着向导一步步来 →
              </Link>
            </div>
          )}

          <p className='text-sm text-slate-500'>
            还没安装客户端？{' '}
            <Link
              to='/get-started'
              className='ml-2 font-medium text-sky-600 hover:text-sky-700'
            >
              从零开始配置 →
            </Link>
          </p>

          <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white sm:px-5'>
            <span className='text-slate-300'>悟空Ai API 地址</span>
            <code className='max-w-full overflow-x-auto text-sky-200'>
              {endpoint}
            </code>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <Suspense fallback={null}>
          <QuickSetupDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialClient={client}
            initialOs={os}
          />
        </Suspense>
      )}
    </section>
  )
}
