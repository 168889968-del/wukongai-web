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
import { KeyRound, Layers3, ReceiptText, Wallet } from 'lucide-react'

const benefits = [
  {
    icon: <KeyRound className='size-5 text-sky-500' />,
    title: '密钥自己管',
    description: '随时停用密钥或设置额度上限',
  },
  {
    icon: <Layers3 className='size-5 text-sky-500' />,
    title: '主流模型都有',
    description: '可用模型与价格在模型广场列出',
  },
  {
    icon: <ReceiptText className='size-5 text-sky-500' />,
    title: '按量计费',
    description: '每次调用都记录在用量日志里',
  },
  {
    icon: <Wallet className='size-5 text-sky-500' />,
    title: '一个余额',
    description: '所有模型共用一个账户余额',
  },
]

export function Stats() {
  return (
    <section className='px-5 py-6 sm:px-8 md:py-8'>
      <div className='mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className='rounded-[1.5rem] bg-slate-50 px-5 py-5 sm:min-h-32 sm:px-6 sm:py-6'
          >
            <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100'>
              {benefit.icon}
            </div>
            <h2 className='text-base font-semibold text-slate-900'>
              {benefit.title}
            </h2>
            <p className='mt-2 text-sm leading-6 text-slate-500'>
              {benefit.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
