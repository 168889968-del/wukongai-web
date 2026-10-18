import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { QuickSetupDialog } from '@/features/quick-setup/quick-setup-dialog'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getLobeIcon } from '@/lib/lobe-icon'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { logo, systemName } = useSystemConfig()
  const [quickSetupOpen, setQuickSetupOpen] = useState(false)

  return (
    <section className={`relative overflow-hidden px-5 pt-24 pb-7 sm:px-8 sm:pt-28 md:pb-9 ${props.className ?? ''}`}>
      <div className='mx-auto grid max-w-7xl items-center gap-7 lg:grid-cols-12 lg:gap-8'>
        <div className='lg:col-span-7'>
          <button
            type='button'
            onClick={() => setQuickSetupOpen(true)}
            className='group mb-5 inline-flex max-w-full items-center gap-2.5 rounded-full border border-sky-200 bg-white/80 py-1.5 pr-4 pl-1.5 text-sm text-slate-600 shadow-sm backdrop-blur transition hover:border-sky-300 hover:bg-white'
          >
            <span className='flex -space-x-1.5' aria-hidden='true'>
              {['OpenAI', 'Claude.Color', 'Grok', 'DeepSeek.Color'].map((icon) => (
                <span key={icon} className='flex size-6 items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900'>
                  {getLobeIcon(icon, 16)}
                </span>
              ))}
            </span>
            <span className='truncate'>ChatGPT、Claude、Grok、DeepSeek 一条命令接入</span>
            <span className='shrink-0 font-semibold text-sky-600'>一键配置</span>
            <ArrowRight className='size-4 shrink-0 text-sky-500 transition group-hover:translate-x-0.5' aria-hidden='true' />
          </button>
          <h1 className='max-w-3xl text-[clamp(2.1rem,3.2vw,3.25rem)] leading-[1.12] font-bold tracking-tight text-slate-950'>
            安全、稳定、透明的
            <span className='block text-sky-500'>AI 模型服务</span>
          </h1>
          <p className='mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg'>
            一个账户使用多种主流模型，价格清晰、按量计费，调用与消费记录随时可查。
          </p>
          <div className='mt-6 flex flex-wrap items-center gap-3'>
            <Button className='h-11 rounded-full bg-sky-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-sky-600' render={<Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />}>
              {props.isAuthenticated ? '进入工作台' : '免费注册'} <ArrowUpRight className='ml-1 size-4' />
            </Button>
            <Button variant='outline' className='h-11 rounded-full border-sky-200 px-5 text-base font-medium text-slate-800 hover:border-sky-300 hover:bg-sky-50' render={<Link to='/skills' />}>
              <Sparkles className='mr-1.5 size-4 text-sky-500' />看能装什么技能
              <span className='ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-600'>新</span>
            </Button>
          </div>
          <div className='mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500'>
            <span className='inline-flex items-center gap-2'><ShieldCheck className='size-4 text-emerald-500' />密钥独立管理</span>
            <span className='inline-flex items-center gap-2'><Zap className='size-4 text-sky-500' />按量计费</span>
          </div>
        </div>
        <div className='lg:col-span-5'>
          <div className='relative flex min-h-[250px] flex-col justify-center overflow-hidden rounded-[1.75rem] bg-blue-600 p-6 text-white shadow-[0_22px_58px_-38px_rgba(37,99,235,0.58)] sm:min-h-[270px] sm:p-7'>
            <div aria-hidden='true' className='absolute inset-y-0 right-0 w-2/5 -skew-x-12 translate-x-8 bg-gradient-to-br from-blue-300/75 via-blue-400/60 to-indigo-300/70 blur-[1px]' />
            <div className='relative z-10'>
              <div className='flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-white/40'>{logo ? <img src={logo} alt={systemName || '悟空Ai'} className='size-full object-contain' /> : null}</div>
              <p className='mt-5 text-sm font-semibold tracking-wide text-blue-50'>GPT Image 2 · AI 图像能力</p>
              <h2 className='mt-1.5 text-3xl leading-tight font-bold'>想法即成图</h2>
              <p className='mt-2 max-w-sm text-sm leading-6 text-blue-50 sm:text-base'>文字生图、参考图创作与图片编辑，一站完成。</p>
              <Button className='mt-5 h-10 rounded-full bg-white px-5 font-semibold text-blue-600 hover:bg-blue-50' render={<Link to='/pricing' />}>
                查看可用模型 <ArrowUpRight className='ml-1 size-4' />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <QuickSetupDialog open={quickSetupOpen} onOpenChange={setQuickSetupOpen} />
    </section>
  )
}
