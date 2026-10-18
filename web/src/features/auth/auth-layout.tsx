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
import { Link } from '@tanstack/react-router'
import { KeyRound, ReceiptText, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CommunityEntry } from '@/components/community-entry'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

const AUTH_HIGHLIGHTS = [
  {
    icon: WalletCards,
    title: '一个余额，用遍主流模型',
    description: '所有模型共用账户余额，不用分别充值。',
  },
  {
    icon: KeyRound,
    title: '密钥自己掌控',
    description: '可随时停用密钥，或给每个密钥设置额度上限。',
  },
  {
    icon: ReceiptText,
    title: '每一笔都查得到',
    description: '调用与扣费记录实时可查，价格提前公示。',
  },
] as const

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='auth-page-shell relative min-h-svh max-w-none'>
      <div className='auth-page-orb auth-page-orb--blue' aria-hidden='true' />
      <div className='auth-page-orb auth-page-orb--violet' aria-hidden='true' />

      <div className='auth-page-grid'>
        <aside className='auth-brand-panel' aria-label={t('平台介绍')}>
          <Link
            to='/'
            className='auth-brand-lockup flex items-center gap-2.5 transition-opacity hover:opacity-80'
          >
            <span className='relative block h-9 w-9'>
              {loading ? (
                <Skeleton className='absolute inset-0 rounded-xl' />
              ) : (
                <img
                  src={logo}
                  alt={t('Logo')}
                  className='h-9 w-9 object-cover'
                />
              )}
            </span>
            {loading ? (
              <Skeleton className='h-6 w-24' />
            ) : (
              <span className='text-xl font-semibold'>{systemName}</span>
            )}
          </Link>

          <div className='auth-brand-copy'>
            <p className='auth-brand-eyebrow'>{t('AI 模型服务平台')}</p>
            <h1 className='auth-brand-title'>
              {t('登录后，')}
              <br />
              {t('一个账户接入多种模型')}
            </h1>
            <p className='auth-brand-lead'>
              {t('按量计费、价格透明，适配 Codex、Claude Code 等常用客户端。')}
            </p>
          </div>

          <ul className='auth-brand-highlights'>
            {AUTH_HIGHLIGHTS.map((item) => (
              <li key={item.title} className='auth-brand-highlight'>
                <span className='auth-brand-highlight-icon' aria-hidden='true'>
                  <item.icon className='size-4' />
                </span>
                <span>
                  <span className='auth-brand-highlight-title'>
                    {t(item.title)}
                  </span>
                  <span className='auth-brand-highlight-text'>
                    {t(item.description)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className='auth-form-panel'>
          <div className='auth-form-inner'>
            <div className='auth-page-card'>{children}</div>
            <p className='auth-form-footnote'>
              {t('遇到问题？点击右下角「加入交流群」联系我们。')}
            </p>
          </div>
        </div>
      </div>
      <CommunityEntry />
    </div>
  )
}
