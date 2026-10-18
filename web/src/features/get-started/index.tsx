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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Link2,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { Button } from '@/components/ui/button'
import { saveAffiliateCode } from '@/features/auth/lib/storage'
import {
  PRIMARY_OPTIONS,
  QuickSetupDialog,
  detectOs,
  type ClientType,
  type OsType,
} from '@/features/quick-setup/quick-setup-dialog'
import { getAffiliateCode as fetchAffiliateCode } from '@/features/wallet/api'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type Step = 1 | 2 | 3

interface InstallGuide {
  /** Does the client install through npm (needs Node.js first)? */
  needsNode: boolean
  command: Record<OsType, string>
  docsUrl: string
  docsLabel: string
  note?: string
}

const NODE_DOWNLOAD_URL = 'https://nodejs.org/zh-cn/download'

const INSTALL_GUIDES: Partial<Record<ClientType, InstallGuide>> = {
  codex: {
    needsNode: true,
    command: {
      windows: 'npm install -g @openai/codex',
      mac: 'npm install -g @openai/codex',
    },
    docsUrl: 'https://github.com/openai/codex',
    docsLabel: 'Codex 官方说明',
  },
  claude: {
    needsNode: true,
    command: {
      windows: 'npm install -g @anthropic-ai/claude-code',
      mac: 'npm install -g @anthropic-ai/claude-code',
    },
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
    docsLabel: 'Claude Code 官方说明',
  },
  grok: {
    needsNode: false,
    command: {
      windows: 'irm https://x.ai/cli/install.ps1 | iex',
      mac: 'curl -fsSL https://x.ai/cli/install.sh | bash',
    },
    docsUrl: 'https://docs.x.ai',
    docsLabel: 'xAI 官方文档',
    note: '安装程序会把 grok 命令放到 ~/.grok/bin，并自动加入 PATH。',
  },
  deepseek: {
    needsNode: true,
    command: {
      windows: 'npx @deepseek-ai/dsh web',
      mac: 'npx @deepseek-ai/dsh web',
    },
    docsUrl: 'https://www.npmjs.com/package/@deepseek-ai/dsh',
    docsLabel: 'DeepSeek Harness 说明',
    note: '需要 Node.js 22.19 或更高版本。运行后会自动打开它的网页设置界面。',
  },
}

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: '选模型' },
  { step: 2, label: '装客户端' },
  { step: 3, label: '一键配置' },
]

function StepProgress(props: { current: Step }) {
  return (
    <ol className='grid grid-cols-3 gap-2 sm:gap-4' aria-label='配置进度'>
      {STEPS.map((item) => {
        const done = item.step < props.current
        const active = item.step === props.current
        return (
          <li key={item.step} aria-current={active ? 'step' : undefined}>
            <div
              className={cn(
                'h-1.5 rounded-full transition-colors',
                done || active ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-800'
              )}
            />
            <p
              className={cn(
                'mt-2 flex items-center gap-1.5 text-sm',
                active ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-500'
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                  done && 'bg-sky-500 text-white',
                  active && 'bg-slate-950 text-white dark:bg-white dark:text-slate-950',
                  !done && !active && 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                )}
              >
                {done ? <Check className='size-3' /> : item.step}
              </span>
              {item.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function OsToggle(props: { value: OsType; onChange: (os: OsType) => void }) {
  return (
    <div className='inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800' aria-label='选择电脑系统'>
      {(
        [
          { value: 'windows', label: 'Windows' },
          { value: 'mac', label: 'Mac / Linux' },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          type='button'
          aria-pressed={props.value === option.value}
          onClick={() => props.onChange(option.value)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
            props.value === option.value
              ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ReferralLinkButton() {
  const affQuery = useQuery({
    queryKey: ['get-started-aff-code'],
    queryFn: async () => fetchAffiliateCode(),
    staleTime: 10 * 60 * 1000,
  })
  const code = typeof affQuery.data?.data === 'string' ? affQuery.data.data : ''
  if (!code) return null
  const link = `${window.location.origin}/get-started?aff=${encodeURIComponent(code)}`
  return (
    <div className='mt-5 flex flex-col items-center gap-1.5'>
      <CopyButton
        value={link}
        variant='outline'
        size='sm'
        className='rounded-full'
        tooltip='复制推荐链接'
        successTooltip='已复制'
        aria-label='复制推荐链接'
      >
        <Link2 className='mr-1.5 size-4' />
        复制推荐链接
      </CopyButton>
      <p className='text-xs text-slate-500'>把这个向导分享给朋友，对方注册后会自动记到你的推荐码下。</p>
    </div>
  )
}

export function GetStarted() {
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const [step, setStep] = useState<Step>(1)
  const [client, setClient] = useState<ClientType>('codex')
  const [os, setOs] = useState<OsType>(detectOs)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Keep a shared invite code so sign-up later credits the referrer
  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) saveAffiliateCode(aff)
  }, [])

  const current = PRIMARY_OPTIONS.find((option) => option.value === client) ?? PRIMARY_OPTIONS[0]
  const guide = INSTALL_GUIDES[client]
  const terminalName = os === 'mac' ? '终端' : 'PowerShell'

  const chooseModel = (value: ClientType) => {
    setClient(value)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <PublicLayout showMainContainer={false}>
      <main className='px-5 pt-28 pb-16 sm:px-8 sm:pt-32'>
        <div className='mx-auto max-w-4xl'>
          <header className='text-center'>
            <p className='text-sm font-semibold text-sky-500'>新手向导</p>
            <h1 className='mt-2 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight font-bold tracking-tight text-slate-950 dark:text-white'>
              三步把 AI 装进你的电脑
            </h1>
            <p className='mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400'>
              选一个模型，装好它的客户端，再一键接入悟空Ai。全程不用手动改配置文件。
            </p>
            {isAuthenticated && <ReferralLinkButton />}
          </header>

          <div className='mt-10'>
            <StepProgress current={step} />
          </div>

          <section className='mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_8px_36px_-32px_rgba(15,23,42,0.22)] sm:p-8 dark:border-slate-800 dark:bg-slate-950'>
            {step === 1 && (
              <div>
                <h2 className='text-center text-xl font-bold text-slate-950 dark:text-white'>你想用哪个模型？</h2>
                <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                  {PRIMARY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => chooseModel(option.value)}
                      className='group flex items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-400 hover:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] dark:border-slate-700'
                    >
                      <span className='flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'>
                        {getLobeIcon(option.icon, 28)}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='block text-lg font-semibold text-slate-950 dark:text-white'>{option.label}</span>
                        <span className='block text-sm text-slate-500'>用 {option.hint}</span>
                      </span>
                      <ArrowRight className='size-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500' aria-hidden='true' />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && guide && (
              <div>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <button
                    type='button'
                    onClick={() => setStep(1)}
                    className='inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  >
                    <ArrowLeft className='size-4' />
                    换个模型
                  </button>
                  <span className='inline-flex items-center gap-2 text-sm font-medium'>
                    {getLobeIcon(current.icon, 20)}
                    {current.label} · {current.hint}
                  </span>
                  <OsToggle value={os} onChange={setOs} />
                </div>

                <h2 className='mt-8 text-center text-xl font-bold text-slate-950 dark:text-white'>
                  先在电脑上装好 {current.hint}
                </h2>

                <ol className='mx-auto mt-6 max-w-2xl space-y-4'>
                  {guide.needsNode && (
                    <li className='rounded-2xl border border-slate-200 p-4 dark:border-slate-700'>
                      <p className='font-semibold'>① 下载并安装 Node.js</p>
                      <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
                        {current.hint} 通过 Node.js 安装。已经装过的可以跳过这一步，选「LTS」版本，一路下一步即可。
                      </p>
                      <Button
                        className='mt-3 rounded-full bg-sky-500 text-white hover:bg-sky-600'
                        render={<a href={NODE_DOWNLOAD_URL} target='_blank' rel='noopener noreferrer' />}
                      >
                        <Download className='mr-1.5 size-4' />
                        下载 Node.js 安装包
                      </Button>
                    </li>
                  )}
                  <li className='rounded-2xl border border-slate-200 p-4 dark:border-slate-700'>
                    <p className='font-semibold'>
                      {guide.needsNode ? '②' : '①'} 打开{terminalName}，运行安装命令
                    </p>
                    <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
                      {os === 'mac'
                        ? 'Mac 在「启动台」里搜索「终端」打开。'
                        : '按 Win 键，搜索「PowerShell」打开。'}
                    </p>
                    <div className='mt-3 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3'>
                      <Terminal className='size-4 shrink-0 text-sky-300' aria-hidden='true' />
                      <code className='min-w-0 flex-1 overflow-x-auto text-sm text-sky-100'>{guide.command[os]}</code>
                      <CopyButton value={guide.command[os]} variant='ghost' size='sm' tooltip='复制' successTooltip='已复制' aria-label='复制安装命令' />
                    </div>
                    {guide.note && <p className='mt-2 text-xs text-slate-500'>{guide.note}</p>}
                  </li>
                </ol>

                <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
                  <Button
                    className='h-11 rounded-full bg-sky-500 px-6 text-base font-semibold text-white hover:bg-sky-600'
                    onClick={() => setStep(3)}
                  >
                    装好了，下一步
                    <ArrowRight className='ml-1.5 size-4' />
                  </Button>
                  <a
                    href={guide.docsUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600'
                  >
                    {guide.docsLabel}
                    <ExternalLink className='size-3.5' />
                  </a>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className='text-center'>
                <div className='flex flex-wrap items-center justify-between gap-3 text-left'>
                  <button
                    type='button'
                    onClick={() => setStep(2)}
                    className='inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  >
                    <ArrowLeft className='size-4' />
                    上一步
                  </button>
                  <span className='inline-flex items-center gap-2 text-sm font-medium'>
                    {getLobeIcon(current.icon, 20)}
                    {current.label} · {current.hint}
                  </span>
                  <OsToggle value={os} onChange={setOs} />
                </div>

                <span className='mx-auto mt-8 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white'>
                  <Sparkles className='size-7' />
                </span>
                <h2 className='mt-4 text-xl font-bold text-slate-950 dark:text-white'>最后一步：接入悟空Ai</h2>

                {isAuthenticated ? (
                  <>
                    <p className='mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400'>
                      选一个你的 API 密钥和模型，生成一条命令，粘贴到{terminalName}运行，然后重新打开 {current.hint} 就能用了。
                    </p>
                    <Button
                      className='mt-6 h-11 rounded-full bg-sky-500 px-6 text-base font-semibold text-white hover:bg-sky-600'
                      onClick={() => setDialogOpen(true)}
                    >
                      <Sparkles className='mr-1.5 size-4' />
                      一键生成配置
                    </Button>
                    <p className='mt-4 text-xs text-slate-500'>
                      还没有余额？
                      <a href='/wallet?topup=1' className='ml-1 text-sky-600 hover:text-sky-700'>
                        去充值
                      </a>
                    </p>
                  </>
                ) : (
                  <>
                    <p className='mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400'>
                      配置里需要填入你的 API 密钥，先注册或登录悟空Ai账号。
                    </p>
                    <div className='mt-6 flex flex-wrap justify-center gap-3'>
                      <Button
                        className='h-11 rounded-full bg-sky-500 px-6 text-base font-semibold text-white hover:bg-sky-600'
                        render={<Link to='/sign-up' />}
                      >
                        免费注册
                      </Button>
                      <Button variant='outline' className='h-11 rounded-full px-6' render={<Link to='/sign-in' />}>
                        已有账号，登录
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <QuickSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialClient={client}
        initialOs={os}
      />
    </PublicLayout>
  )
}
