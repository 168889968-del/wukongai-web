import { ArrowRight, Sparkles } from 'lucide-react'

import { skills } from '@/features/skills-showcase/skills-catalog-data'

const featuredIds = [
  'editable-deck',
  'word-docs',
  'gpt-image-2',
  'thesis',
  'browser',
  'github',
]

export function SkillsSection() {
  const featured = featuredIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill) => skill !== undefined)

  return (
    <section className='px-5 py-12 sm:px-8 md:py-16'>
      <div className='mx-auto max-w-7xl'>
        <div className='mx-auto mb-8 max-w-3xl text-center'>
          <p className='text-sm font-semibold text-sky-500'>技能广场</p>
          <h2 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl'>
            给 Codex 装点能力
          </h2>
          <p className='mx-auto mt-3 max-w-3xl text-base leading-7 text-slate-600'>
            查论文、做文档、操作浏览器或查开发资料。安装前先看清技能类型和权限，再按需使用。
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {featured.map((skill) => {
            const Icon = skill.icon
            return (
              <a
                key={skill.id}
                href={`/skills?skill=${encodeURIComponent(skill.id)}`}
                className='group min-h-48 rounded-[1.5rem] bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-sky-50/70 hover:shadow-[0_14px_40px_-30px_rgba(14,116,224,0.35)] sm:p-6'
              >
                <div className='flex size-9 items-center justify-center rounded-xl bg-white text-sky-500 shadow-sm ring-1 ring-slate-100'>
                  <Icon className='size-5' strokeWidth={1.7} />
                </div>
                <h3 className='mt-4 text-lg font-semibold text-slate-950'>
                  {skill.title}
                </h3>
                <p className='mt-2 text-sm leading-6 text-slate-600'>
                  {skill.description}
                </p>
                <span className='mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600'>
                  查看技能 <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
                </span>
              </a>
            )
          })}
        </div>

        <div className='mt-6 text-center'>
          <a
            href='/skills'
            className='inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 transition hover:border-sky-200 hover:text-sky-600'
          >
            <Sparkles className='size-4 text-sky-500' />
            浏览全部 {skills.length} 项技能
          </a>
        </div>
      </div>
    </section>
  )
}
