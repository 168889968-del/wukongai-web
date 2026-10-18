import { UsersRound } from 'lucide-react'

export function CommunitySection() {
  return (
    <section className='px-5 py-10 sm:px-8 md:py-14'>
      <div className='mx-auto grid max-w-7xl items-center gap-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 sm:grid-cols-[1fr_auto] sm:p-8'>
        <div className='max-w-xl'>
          <p className='text-sm font-semibold text-sky-500'>悟空Ai · 社区</p>
          <h2 className='mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl'>加入悟空Ai交流群</h2>
          <p className='mt-3 text-base leading-7 text-slate-600'>获取产品动态、使用技巧和技术支持。</p>
          <div className='mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-200'>
            <UsersRound className='size-4 text-sky-500' />QQ群号：603378289
          </div>
          <p className='mt-3 text-sm text-slate-500'>也可以点击页面右下角“加入交流群”打开二维码。</p>
        </div>
        <div className='flex items-center justify-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'>
          <img src='/wukongai-group-qr.png' alt='悟空Ai学习交流群 QQ 群二维码' className='size-40 object-contain sm:size-48' />
        </div>
      </div>
    </section>
  )
}
