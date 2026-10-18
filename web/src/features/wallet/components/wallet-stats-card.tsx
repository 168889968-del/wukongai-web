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
import { Activity, BarChart3, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
  onRecharge?: () => void
  onOpenBilling?: () => void
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
        {['balance', 'usage', 'requests'].map((key) => (
          <div key={key} className='min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5'>
            <div className='flex items-center gap-2'>
              <Skeleton className='size-9 rounded-full' />
              <Skeleton className='h-4 w-28' />
            </div>
            <Skeleton className='mt-4 h-8 w-32' />
            <Skeleton className='mt-2 h-4 w-24' />
          </div>
        ))}
      </div>
    )
  }

  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Current Balance'),
      value: formatQuota(props.user?.quota ?? 0),
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
    },
    {
      label: t('Total Usage'),
      value: formatQuota(props.user?.used_quota ?? 0),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
      {stats.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${index === 0 ? 'border-sky-100 bg-gradient-to-br from-sky-50 to-white' : index === 1 ? 'border-blue-100 bg-gradient-to-br from-blue-50/70 to-white' : 'border-fuchsia-100 bg-gradient-to-br from-fuchsia-50/70 to-white'}`}
        >
          <div className='flex items-center gap-1.5 sm:gap-2.5'>
            <IconBadge tone={item.tone} size='stat'>
              <item.icon />
            </IconBadge>
            <div className='text-muted-foreground truncate text-sm font-medium'>
              {item.label}
            </div>
          </div>

          <div className='text-foreground mt-3 font-mono text-2xl font-bold tracking-tight break-all tabular-nums sm:mt-4 sm:text-3xl'>
            {item.value}
          </div>
          <div className='text-muted-foreground mt-1 text-sm'>
            {item.description}
          </div>
          {index === 0 && (props.onRecharge || props.onOpenBilling) && (
            <div className='mt-4 flex flex-wrap gap-2'>
              {props.onRecharge && (
                <Button onClick={props.onRecharge} className='h-9 rounded-full bg-sky-500 px-4 text-sm text-white hover:bg-sky-600'>
                  {t('Account Recharge')}
                </Button>
              )}
              {props.onOpenBilling && (
                <Button onClick={props.onOpenBilling} variant='outline' className='h-9 rounded-full bg-white px-4 text-sm'>
                  {t('Order History')}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
