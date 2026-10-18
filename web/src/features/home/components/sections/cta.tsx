import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  if (props.isAuthenticated) return null
  return (
    <section className='px-5 py-8 sm:px-8 md:py-12'>
      <div className='mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[1.75rem] bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-9'>
        <div className='max-w-2xl'>
          <h2 className='text-2xl font-bold tracking-tight sm:text-3xl'>准备好使用悟空Ai了吗？</h2>
          <p className='mt-2 text-sm leading-6 text-blue-50 sm:text-base'>创建账户、充值并完成客户端配置，即可开始使用。</p>
        </div>
        <div className='flex shrink-0 flex-wrap gap-3'>
          <Link to='/sign-up' className='inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50'>开始使用<ArrowRight className='size-4' /></Link>
          <Link to='/pricing' className='inline-flex h-10 items-center rounded-full border border-white/45 px-5 text-sm font-medium text-white transition hover:bg-white/10'>查看模型价格</Link>
        </div>
      </div>
    </section>
  )
}
