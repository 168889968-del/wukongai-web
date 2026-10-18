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
import { ArrowRight } from 'lucide-react'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { formatPrice } from '@/features/pricing/lib/price'

export function ModelPricingPreview() {
  const { models, isLoading, priceRate, usdExchangeRate } = usePricingData()
  const featuredModels = models.slice(0, 6)

  return (
    <section className='bg-slate-50/70 px-5 py-10 sm:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <p className='text-sm font-semibold tracking-wide text-sky-500'>
              模型价格
            </p>
            <h2 className='mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl'>
              使用之前，价格先看清
            </h2>
            <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base'>
              热门模型价格直接读取悟空Ai后台配置，完整价格目录和计费方式都可以随时查看。
            </p>
          </div>
          <Link
            to='/pricing'
            className='inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:border-sky-200 hover:text-sky-600 md:self-auto'
          >
            查看全部模型
            <ArrowRight className='size-4' />
          </Link>
        </div>

        <div className='overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[680px] border-collapse text-left'>
              <thead className='bg-slate-50 text-sm text-slate-500'>
                <tr>
                  <th className='px-5 py-3 font-medium'>模型</th>
                  <th className='px-5 py-3 font-medium'>输入价格</th>
                  <th className='px-5 py-3 font-medium'>输出价格</th>
                  <th className='px-5 py-3 font-medium'>状态</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`loading-${index}`} className='border-t border-slate-100'>
                      <td colSpan={4} className='px-5 py-4'>
                        <div className='h-4 w-full max-w-[32rem] animate-pulse rounded bg-slate-100' />
                      </td>
                    </tr>
                  ))}
                {!isLoading &&
                  featuredModels.map((model) => (
                    <tr
                      key={model.model_name}
                      className='border-t border-slate-100 transition hover:bg-slate-50/70'
                    >
                      <td className='px-5 py-4'>
                        <Link
                          to='/pricing'
                          className='font-medium text-slate-900 hover:text-sky-600'
                        >
                          {model.model_name}
                        </Link>
                        <p className='mt-1 text-xs text-slate-500'>
                          {model.vendor_name || '悟空Ai 模型服务'}
                        </p>
                      </td>
                      <td className='px-5 py-4 text-sm text-slate-700'>
                        {formatPrice(
                          model,
                          'input',
                          'M',
                          false,
                          priceRate,
                          usdExchangeRate,
                          undefined,
                          true
                        )}{' '}
                        <span className='text-slate-400'>/ 1M</span>
                      </td>
                      <td className='px-5 py-4 text-sm text-slate-700'>
                        {formatPrice(
                          model,
                          'output',
                          'M',
                          false,
                          priceRate,
                          usdExchangeRate,
                          undefined,
                          true
                        )}{' '}
                        <span className='text-slate-400'>/ 1M</span>
                      </td>
                      <td className='px-5 py-4'>
                        <span className='inline-flex items-center gap-2 text-sm text-slate-700'>
                          <span className='size-2 rounded-full bg-emerald-500' />
                          价格已公示
                        </span>
                      </td>
                    </tr>
                  ))}
                {!isLoading && featuredModels.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className='px-5 py-10 text-center text-sm text-slate-500'
                    >
                      暂无公开模型价格，稍后可前往模型广场查看。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className='mt-4 text-xs leading-5 text-slate-500'>
          表格展示当前目录中的部分价格；具体计费规则及可用范围以模型详情页为准。
        </p>
      </div>
    </section>
  )
}
