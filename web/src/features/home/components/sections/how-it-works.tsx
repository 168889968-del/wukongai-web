import { Link } from '@tanstack/react-router'
import { KeyRound, Laptop, MessageSquareText, Sparkles, WalletCards } from 'lucide-react'
import { useState } from 'react'

import { QuickSetupDialog } from '@/features/quick-setup/quick-setup-dialog'

type Client = 'codex' | 'claude'

const baseSteps = [
  { title: '安装客户端', description: '在电脑上安装 Codex 或 Claude Code 桌面版。', icon: Laptop },
  { title: '充值账户', description: '在账户余额里充值，按实际调用量扣费。', icon: WalletCards },
  { title: '创建 API 密钥', description: '在控制台生成密钥，并设置需要的额度。', icon: KeyRound },
  { title: '一键配置，开始对话', description: '用「一键配置」生成配置文件，保存后重启客户端即可使用。', icon: MessageSquareText },
]

export function HowItWorks() {
  const [client, setClient] = useState<Client>('codex')
  const [quickSetupOpen, setQuickSetupOpen] = useState(false)
  const endpoint = client === 'codex' ? 'https://wukongai.work/v1' : 'https://wukongai.work'

  return (
    <section className='px-5 py-6 sm:px-8 md:py-8'>
      <div className='mx-auto max-w-7xl rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_8px_36px_-32px_rgba(15,23,42,0.22)] sm:p-6 md:p-7'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-sm font-semibold text-sky-500'>开始使用</p>
            <h2 className='mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.75rem]'>四步接上 Codex</h2>
          </div>
          <div className='flex items-center gap-2'>
            <div className='inline-flex rounded-full bg-slate-100 p-1' aria-label='选择客户端'>
              <button type='button' onClick={() => setClient('codex')} aria-pressed={client === 'codex'} className={`rounded-full px-4 py-2 text-sm transition ${client === 'codex' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}>Codex</button>
              <button type='button' onClick={() => setClient('claude')} aria-pressed={client === 'claude'} className={`rounded-full px-4 py-2 text-sm transition ${client === 'claude' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}>Claude Code</button>
            </div>
            <button type='button' onClick={() => setQuickSetupOpen(true)} className='inline-flex h-10 items-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-medium text-white transition hover:bg-sky-600'><Sparkles className='size-4' />一键配置 {client === 'codex' ? 'Codex' : 'Claude Code'}</button>
          </div>
        </div>
        <div className='relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <div aria-hidden='true' className='absolute top-7 right-[12%] left-[12%] hidden h-px bg-sky-100 xl:block' />
          {baseSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <article key={step.title} className='relative z-10 min-h-32 rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5'>
                <div className='flex items-center gap-3'>
                  <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500'><Icon className='size-5' strokeWidth={1.7} /></span>
                  <h3 className='text-base font-semibold text-slate-950'><span className='mr-1.5 text-slate-400'>{index + 1}.</span>{step.title}</h3>
                </div>
                <p className='mt-3 pl-[52px] text-sm leading-6 text-slate-600'>
                  {index === 1 ? <>{step.description} <Link to='/wallet' className='whitespace-nowrap font-medium text-sky-600 hover:text-sky-700'>立即充值</Link></> : index === 2 ? <>{step.description} <Link to='/keys' className='whitespace-nowrap font-medium text-sky-600 hover:text-sky-700'>创建密钥</Link></> : step.description}
                </p>
              </article>
            )
          })}
        </div>
        <div className='mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white sm:px-5'>
          <span className='text-slate-300'>悟空Ai API 地址</span><code className='max-w-full overflow-x-auto text-sky-200'>{endpoint}</code>
        </div>
      </div>
      <QuickSetupDialog open={quickSetupOpen} onOpenChange={setQuickSetupOpen} />
    </section>
  )
}
