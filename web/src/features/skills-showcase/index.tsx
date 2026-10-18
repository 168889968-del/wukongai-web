import { ArrowUpRight, Check, Copy, ExternalLink, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'

import { categoryLabel, skillCategories, skills, skillMetadata, type SkillCategoryId, type SkillItem } from './skills-catalog-data'
import { useAuthStore } from '@/stores/auth-store'

function currentCategory(): 'all' | SkillCategoryId {
  const value = new URLSearchParams(window.location.search).get('category')
  return skillCategories.some((category) => category.id === value)
    ? (value as 'all' | SkillCategoryId)
    : 'all'
}

function currentSkill() {
  const id = new URLSearchParams(window.location.search).get('skill')
  return skills.find((skill) => skill.id === id) ?? null
}

export function SkillsShowcase() {
  const [category, setCategory] = useState<'all' | SkillCategoryId>(currentCategory)
  const [selected, setSelected] = useState<SkillItem | null>(currentSkill)
  const [copied, setCopied] = useState(false)
  const [showAccessDetails, setShowAccessDetails] = useState(false)
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  useEffect(() => {
    const syncFromAddress = () => {
      setCategory(currentCategory())
      setSelected(currentSkill())
    }
    window.addEventListener('popstate', syncFromAddress)
    return () => window.removeEventListener('popstate', syncFromAddress)
  }, [])

  useEffect(() => {
    if (!selected) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selected])

  const visibleSkills = useMemo(
    () => (category === 'all' ? skills : skills.filter((skill) => skill.category === category)),
    [category]
  )

  const openDetails = (skill: SkillItem) => {
    const params = new URLSearchParams(window.location.search)
    params.set('skill', skill.id)
    window.history.pushState({ skill: skill.id }, '', `/skills?${params.toString()}`)
    setCopied(false)
    setShowAccessDetails(false)
    setSelected(skill)
  }

  function closeDetails() {
    setSelected(null)
    setCopied(false)
    const params = new URLSearchParams(window.location.search)
    params.delete('skill')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }

  const selectCategory = (id: 'all' | SkillCategoryId) => {
    setCategory(id)
    const params = new URLSearchParams(window.location.search)
    if (id === 'all') params.delete('category')
    else params.set('category', id)
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }

  const copyPrompt = async () => {
    if (!selected) return
    const prompt = `请帮我使用「${selected.title}」。先说明需要读取或安装的文件、脚本、外部服务和权限；不要直接执行，等我确认后再继续。\n\n我的任务：${selected.example}`
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <PublicLayout showMainContainer={false}>
    <main className='min-h-[calc(100svh-4rem)] px-5 pt-24 pb-16 sm:px-8 sm:pt-28'>
      <header className='mx-auto mb-8 max-w-3xl text-center'>
        <p className='text-sm font-semibold text-sky-500'>悟空Ai · 技能广场</p>
        <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl'>
          Codex 技能与 MCP 能力目录
        </h1>
        <p className='mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600'>
          按需扩展 Codex。这里同时收录 Skill（指令与脚本）和 MCP（外部工具），安装前先确认用途、依赖与访问权限。
        </p>
      </header>

      <aside className='mx-auto mb-6 flex max-w-7xl flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-4 text-sm leading-6 text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <span>已安装的 MCP 工具会随每轮对话提供工具列表；安装过多会增加上下文开销。只启用当前需要的能力，安装后在新会话中确认连接状态。</span>
        {!isAuthenticated && <a href='/sign-in?redirect=%2Fskills' className='inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-sky-500 px-4 font-medium text-white hover:bg-sky-600'>登录后设置助手</a>}
      </aside>

      <nav aria-label='技能分类' className='mx-auto mb-6 flex max-w-7xl gap-2 overflow-x-auto pb-2'>
        {skillCategories.map((item) => (
          <button
            key={item.id}
            type='button'
            onClick={() => selectCategory(item.id)}
            aria-pressed={category === item.id}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${category === item.id ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-600'}`}
          >
            {item.label}
            <span className='ml-1.5 text-xs opacity-70'>
              {item.id === 'all' ? skills.length : skills.filter((skill) => skill.category === item.id).length}
            </span>
          </button>
        ))}
      </nav>

      <section aria-label='技能列表' className='mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {visibleSkills.map((skill) => {
          const Icon = skill.icon
          const metadata = skillMetadata[skill.id]
          return (
            <article key={skill.id} className='flex min-h-52 flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_16px_42px_-32px_rgba(14,116,224,0.42)] sm:p-6'>
              <button type='button' onClick={() => openDetails(skill)} className='flex flex-1 flex-col text-left'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-500'>
                    <Icon className='size-5' strokeWidth={1.7} />
                  </div>
                  <div className='flex flex-wrap justify-end gap-1.5 text-xs'>
                    <span className='rounded-full bg-slate-100 px-2.5 py-1 text-slate-600'>{metadata?.kind ?? 'Skill'}</span>
                    {metadata?.recommended && <span className='rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700'>推荐</span>}
                    <span className='rounded-full bg-slate-100 px-2.5 py-1 text-slate-500'>约 {metadata?.duration ?? '5–12 分钟'}</span>
                  </div>
                </div>
                <h2 className='mt-4 text-lg font-semibold leading-7 text-slate-950'>{skill.title}</h2>
                <p className='mt-2 text-sm leading-6 text-slate-600'>{skill.description}</p>
                <div className='mt-4 flex flex-wrap gap-2'>
                  <span className='rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500'>{categoryLabel(skill.category)}</span>
                </div>
              </button>
              <button type='button' onClick={() => openDetails(skill)} className='mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-sky-600 hover:text-sky-700'>
                查看详情 <ArrowUpRight className='size-4' />
              </button>
            </article>
          )
        })}
      </section>

      {selected && (
        <div className='fixed inset-0 z-[70] flex justify-end bg-slate-950/35 backdrop-blur-[2px]' onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails() }}>
          <aside role='dialog' aria-modal='true' aria-labelledby='skill-detail-title' className='flex h-full w-full max-w-[620px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl'>
            {(() => {
              const metadata = skillMetadata[selected.id]
              return (
                <>
            <div className='flex items-start justify-between gap-5 border-b border-slate-100 px-5 py-5 sm:px-7'>
              <div>
                <div className='flex flex-wrap items-center gap-2 text-xs text-slate-500'>
                  <span>{categoryLabel(selected.category)}</span>
                  <span>·</span>
                  <span>{metadata?.kind ?? 'Skill'}</span>
                  <span>·</span>
                  <span>约 {metadata?.duration ?? '5–12 分钟'}</span>
                  {metadata?.recommended && <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700'>推荐</span>}
                </div>
                <h2 id='skill-detail-title' className='mt-2 text-xl font-bold leading-7 text-slate-950'>{selected.title}</h2>
              </div>
              <button type='button' aria-label='关闭详情' onClick={closeDetails} className='flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900'>
                <X className='size-5' />
              </button>
            </div>

            <div className='flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7'>
              <section>
                <h3 className='text-sm font-semibold text-slate-900'>能力介绍</h3>
                <p className='mt-2 text-sm leading-7 text-slate-600'>{selected.description}</p>
              </section>
              <section className='rounded-2xl bg-slate-50 p-4 sm:p-5'>
                <h3 className='text-sm font-semibold text-slate-900'>可以这样使用</h3>
                <p className='mt-2 text-sm leading-7 text-slate-600'>“{selected.example}”</p>
              </section>
              <section className='rounded-2xl border border-slate-200 p-4 sm:p-5'>
                <h3 className='text-sm font-semibold text-slate-900'>安装前准备</h3>
                <p className='mt-2 text-sm leading-7 text-slate-600'>{metadata?.requirement ?? '安装前查看来源项目说明，并确认需要授予的文件、网络或账户访问权限。'}</p>
                <p className='mt-2 text-xs leading-5 text-slate-500'>安装后请在新会话中验证连接；不再需要时可从 Codex 设置中移除。</p>
              </section>
              {showAccessDetails && <section className='rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5'>
                <h3 className='text-sm font-semibold text-slate-900'>权限核对</h3>
                <p className='mt-2 text-sm leading-7 text-slate-600'>Skill 可能包含指令和脚本；MCP 会连接外部服务并提供工具。安装前核对项目来源、依赖和访问范围，只启用当前需要的能力。</p>
              </section>}
            </div>

            <div className='flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4 sm:px-7'>
              <button type='button' onClick={copyPrompt} className='inline-flex h-10 items-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-medium text-white transition hover:bg-sky-600'>
                {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
                {copied ? '已复制使用提示' : '复制使用提示'}
              </button>
              <button type='button' onClick={() => setShowAccessDetails((shown) => !shown)} className='inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-600'>
                {showAccessDetails ? '收起权限说明' : '查看权限说明'}
              </button>
              {metadata?.sourceUrl && <a href={metadata.sourceUrl} target='_blank' rel='noopener noreferrer' className='inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-600'>查看项目 <ExternalLink className='size-4' /></a>}
              {metadata?.previewUrl && <a href={metadata.previewUrl} target='_blank' rel='noopener noreferrer' className='inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-600'>查看演示 <ExternalLink className='size-4' /></a>}
              {!isAuthenticated && <a href={`/sign-in?redirect=${encodeURIComponent(`/skills?skill=${selected.id}`)}`} className='inline-flex h-10 items-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-medium text-white transition hover:bg-sky-600'>登录后设置助手 <ExternalLink className='size-4' /></a>}
            </div>
                </>
              )
            })()}
          </aside>
        </div>
      )}
    </main>
    <Footer />
    </PublicLayout>
  )
}
