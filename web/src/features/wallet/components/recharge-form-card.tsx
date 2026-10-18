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
import {
  Clock3,
  Gift,
  ExternalLink,
  Loader2,
  Receipt,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { FaQq } from 'react-icons/fa6'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  formatCurrency,
  getDiscountLabel,
  getPaymentIcon,
  getMinTopupAmount,
  calculatePresetPricing,
} from '../lib'
import type {
  PaymentMethod,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemProductsSection } from './creem-products-section'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number
  calculating: boolean
  onPaymentMethodSelect: (method: PaymentMethod) => void
  onPaymentMethodChange?: (method: PaymentMethod) => void
  selectedPaymentMethod?: PaymentMethod
  paymentLoading: string | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  priceRatio?: number
  usdExchangeRate?: number
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  onWaffoMethodChange?: (method: WaffoPayMethod, index: number) => void
  selectedWaffoMethodIndex?: number | null
  enableWaffoPancakeTopup?: boolean
  embedded?: boolean
  hidePaymentMethods?: boolean
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  paymentAmount,
  calculating,
  onPaymentMethodSelect,
  onPaymentMethodChange,
  selectedPaymentMethod,
  paymentLoading,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  priceRatio = 1,
  usdExchangeRate = 1,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  onWaffoMethodChange,
  selectedWaffoMethodIndex,
  enableWaffoPancakeTopup,
  embedded = false,
  hidePaymentMethods = false,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())
  const [supportOpen, setSupportOpen] = useState(false)

  useEffect(() => {
    // Empty string must survive, otherwise the field can never be cleared
    setLocalAmount((prev) =>
      prev === '' && topupAmount === 0 ? prev : topupAmount.toString()
    )
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    const numValue = Number.parseInt(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  const hasConfigurableTopup =
    topupInfo?.enable_online_topup ||
    topupInfo?.enable_stripe_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const hasStandardPaymentMethods =
    Array.isArray(topupInfo?.pay_methods) && topupInfo.pay_methods.length > 0
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  const minTopup = getMinTopupAmount(topupInfo)
  const redemptionEnabled = topupInfo?.enable_redemption !== false

  if (loading) {
    return (
      <Card
        data-card-hover='false'
        className={cn(
          'gap-0 overflow-hidden py-0',
          embedded && 'rounded-none border-0 bg-transparent shadow-none ring-0'
        )}
      >
        <CardHeader
          className={cn(
            'border-b p-3 !pb-3 sm:p-5 sm:!pb-5',
            embedded && 'px-0 pt-0 sm:px-0 sm:pt-0'
          )}
        >
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent
          className={cn(
            'space-y-4 p-3 sm:space-y-6 sm:p-5',
            embedded && 'px-0 sm:px-0'
          )}
        >
          <div className='space-y-4 sm:space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                  (key) => (
                    <Skeleton key={key} className='h-[72px] rounded-lg' />
                  )
                )}
              </div>
            </div>

            {/* Custom Amount Input Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-[42px] w-full' />
            </div>

            {/* Payment Methods Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-32' />
              <div className='flex flex-wrap gap-3'>
                {['primary', 'secondary', 'tertiary'].map((key) => (
                  <Skeleton key={key} className='h-10 w-24 rounded-lg' />
                ))}
              </div>
            </div>
          </div>

          {/* Redemption Code Section Skeleton */}
          <div className='space-y-3 border-t pt-8'>
            <Skeleton className='h-3 w-24' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-20' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      className={
        embedded
          ? 'rounded-none border-0 bg-transparent shadow-none ring-0'
          : undefined
      }
      headerClassName={embedded ? 'hidden' : undefined}
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4 w-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName={cn(
        'space-y-4 sm:space-y-6',
        embedded && 'px-0 pb-0 sm:px-0 sm:pb-0'
      )}
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {hasConfigurableTopup && (
            <>
              {presetAmounts.length > 0 && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <Label
                      className={
                        embedded
                          ? 'text-base font-medium'
                          : 'text-muted-foreground text-xs font-medium tracking-wider uppercase'
                      }
                    >
                      {embedded ? t('Recharge packages') : t('Amount')}
                    </Label>
                    {embedded && (
                      <span className='text-muted-foreground text-xs sm:text-sm'>
                        {t('Credit is added in USD')}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'grid gap-2.5 pt-2 sm:gap-3',
                      embedded
                        ? 'grid-cols-1 sm:grid-cols-3'
                        : 'grid-cols-2 md:grid-cols-4'
                    )}
                  >
                    {presetAmounts.map((preset) => {
                      const discount =
                        preset.discount ||
                        topupInfo?.discount?.[preset.value] ||
                        1.0
                      const { actualPrice, savedAmount, hasDiscount } =
                        calculatePresetPricing(
                          preset.value,
                          priceRatio,
                          discount,
                          usdExchangeRate
                        )
                      if (embedded) {
                        const selected =
                          selectedPreset === preset.value ||
                          (selectedPreset === null &&
                            topupAmount === preset.value)
                        return (
                          <Button
                            key={preset.value}
                            type='button'
                            variant='outline'
                            aria-pressed={selected}
                            className={cn(
                              'relative h-auto min-h-32 min-w-0 flex-col items-start justify-center gap-0 rounded-2xl border px-4 py-4 text-left whitespace-normal shadow-none sm:min-h-36',
                              selected
                                ? 'border-sky-500 bg-sky-50/70 hover:bg-sky-50 dark:bg-sky-500/10'
                                : 'border-border bg-background hover:border-sky-300 hover:bg-sky-50/30'
                            )}
                            onClick={() => onSelectPreset(preset)}
                          >
                            <span className='text-muted-foreground w-full text-sm leading-6 font-normal'>
                              {t('获得 {{amount}} 美元额度', {
                                amount: formatNumber(preset.value),
                              })}
                            </span>
                            <span className='text-foreground mt-3 flex items-baseline gap-1'>
                              <span className='text-base font-medium'>¥</span>
                              <span className='text-[2rem] leading-none font-semibold tracking-tight tabular-nums'>
                                {formatCurrency(actualPrice)}
                              </span>
                            </span>
                            <span className='text-muted-foreground mt-4 text-xs leading-5 font-normal sm:text-sm'>
                              {t('Automatic credit after payment')}
                            </span>
                          </Button>
                        )
                      }
                      return (
                        <Button
                          key={preset.value}
                          variant='outline'
                          aria-pressed={selectedPreset === preset.value}
                          className={cn(
                            'wk-topup-preset relative flex min-h-[96px] flex-col items-start justify-center rounded-2xl px-4 pt-5 pb-3.5 text-left whitespace-normal sm:min-h-[112px] sm:px-5',
                            selectedPreset === preset.value
                              ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)] hover:bg-sky-50 dark:bg-sky-500/10'
                              : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
                          )}
                          onClick={() => onSelectPreset(preset)}
                        >
                          {hasDiscount && (
                            <span className='absolute -top-2 right-3 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 py-0.5 text-[11px] leading-4 font-semibold text-white shadow-sm'>
                              {getDiscountLabel(discount, t)}
                            </span>
                          )}
                          <div className='text-foreground text-xl leading-tight font-bold tracking-tight sm:text-2xl'>
                            {formatCurrency(actualPrice)}
                          </div>
                          <div className='text-muted-foreground mt-1 w-full text-xs leading-5'>
                            {t('获得 {{amount}} 美元额度', {
                              amount: formatNumber(preset.value),
                            })}
                          </div>
                          {hasDiscount && savedAmount > 0 && (
                            <div className='w-full text-[11px] leading-4 font-medium text-emerald-600'>
                              <Trans
                                t={t}
                                i18nKey='立省 <savings>{{saved}}</savings>'
                                values={{ saved: formatCurrency(savedAmount) }}
                                components={{ savings: <span /> }}
                              />
                            </div>
                          )}
                        </Button>
                      )
                    })}
                    {embedded && (
                      <Dialog
                        open={supportOpen}
                        onOpenChange={setSupportOpen}
                        title={t('Custom recharge')}
                        description={t(
                          'For large recharges, please contact your dedicated support representative.'
                        )}
                        contentClassName='rounded-3xl p-5 sm:max-w-[670px] sm:p-6'
                        headerClassName='gap-2 pr-8'
                        titleClassName='text-xl font-medium text-foreground'
                        descriptionClassName='text-base leading-7 text-muted-foreground'
                        bodyClassName='pt-5 pb-1'
                        trigger={
                          <Button
                            type='button'
                            variant='outline'
                            className='border-border h-auto min-h-32 min-w-0 flex-col items-start justify-center gap-2 rounded-2xl px-4 py-4 text-left whitespace-normal shadow-none hover:border-sky-300 hover:bg-sky-50/30 sm:min-h-36'
                          >
                            <span className='text-base font-medium'>
                              {t('Custom recharge')}
                            </span>
                            <span className='text-muted-foreground text-sm font-normal'>
                              {t('Contact QQ support')}
                            </span>
                          </Button>
                        }
                      >
                        <div className='border-border bg-muted/20 flex min-h-[74px] items-center justify-between gap-3 rounded-3xl border px-4 py-4'>
                          <span className='text-muted-foreground min-w-0 text-base font-normal sm:text-lg'>
                            悟空Ai
                          </span>
                          <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
                            <FaQq
                              className='size-5 shrink-0 text-sky-500'
                              aria-hidden='true'
                            />
                            <span className='text-foreground text-base font-normal tabular-nums sm:text-xl'>
                              168889968
                            </span>
                            <CopyButton
                              value='168889968'
                              aria-label={t('Copy QQ number')}
                              className='text-foreground ml-1'
                              iconClassName='size-4'
                            />
                          </div>
                        </div>
                      </Dialog>
                    )}
                  </div>
                </div>
              )}

              {!embedded && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label
                    htmlFor='topup-amount'
                    className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
                  >
                    {t('Custom Amount')}
                  </Label>
                  <div
                    className={cn(
                      'grid gap-2 lg:items-center',
                      embedded
                        ? 'grid-cols-1'
                        : 'grid-cols-[minmax(0,1fr)_minmax(110px,0.55fr)] lg:grid-cols-[minmax(0,1fr)_auto]'
                    )}
                  >
                    <Input
                      id='topup-amount'
                      type='number'
                      value={localAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      min={minTopup}
                      placeholder={t('Minimum {{amount}}', {
                        amount: minTopup,
                      })}
                      className='h-9 text-base sm:h-10 sm:text-lg'
                    />
                    {!embedded && (
                      <div className='bg-muted/30 flex min-h-9 items-center justify-between gap-2 rounded-md border px-3 lg:min-w-52'>
                        <span className='text-muted-foreground truncate text-xs'>
                          {t('Amount to pay:')}
                        </span>
                        {calculating ? (
                          <Skeleton className='h-5 w-16' />
                        ) : (
                          <span className='text-sm font-semibold'>
                            {formatCurrency(paymentAmount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!hidePaymentMethods && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Payment Method')}
                  </Label>
                  {hasStandardPaymentMethods ? (
                    <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
                      {topupInfo?.pay_methods?.map((method) => {
                        const minTopup = Math.max(
                          method.min_topup || 0,
                          getMinTopupAmount(topupInfo)
                        )
                        const disabled = minTopup > topupAmount
                        const disabledReason = disabled
                          ? t('Minimum topup amount: {{amount}}', {
                              amount: minTopup,
                            })
                          : undefined
                        const disabledLabel = disabled
                          ? `${t('Minimum:')} ${minTopup}`
                          : undefined

                        const button = (
                          <Button
                            key={method.type}
                            variant='outline'
                            onClick={() =>
                              (onPaymentMethodChange ?? onPaymentMethodSelect)(
                                method
                              )
                            }
                            disabled={disabled || !!paymentLoading}
                            title={disabledReason}
                            aria-label={
                              disabledReason
                                ? `${method.name}. ${disabledReason}`
                                : method.name
                            }
                            className={cn(
                              'min-h-14 min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left',
                              selectedPaymentMethod?.type === method.type &&
                                'border-sky-500 bg-sky-50 text-sky-700 hover:bg-sky-50'
                            )}
                          >
                            {paymentLoading === method.type ? (
                              <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                              getPaymentIcon(
                                method.type,
                                'h-4 w-4',
                                method.icon,
                                method.name
                              )
                            )}
                            <span className='flex min-w-0 flex-col items-start gap-0.5'>
                              <span className='max-w-full truncate'>
                                {method.name}
                              </span>
                              {disabledLabel && (
                                <span className='text-muted-foreground max-w-full truncate text-[11px] leading-4 font-normal'>
                                  {disabledLabel}
                                </span>
                              )}
                            </span>
                          </Button>
                        )

                        return disabled ? (
                          <TooltipProvider key={method.type}>
                            <Tooltip>
                              <TooltipTrigger render={button} />
                              <TooltipContent>{disabledReason}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          button
                        )
                      })}
                    </div>
                  ) : null}
                  {!hasStandardPaymentMethods && !hasWaffoPaymentMethods && (
                    <Alert>
                      <AlertDescription>
                        {t(
                          'No payment methods available. Please contact administrator.'
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {!hidePaymentMethods &&
                enableWaffoTopup &&
                hasWaffoPaymentMethods &&
                (onWaffoMethodChange || onWaffoMethodSelect) && (
                  <div className='space-y-2.5 sm:space-y-3'>
                    <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Waffo Payment')}
                    </Label>
                    <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
                      {waffoPayMethods?.map((method, index) => {
                        const loadingKey = `waffo-${index}`
                        const methodKey = `${method.payMethodType ?? 'unknown'}-${method.payMethodName ?? method.name}`
                        const waffoMin = waffoMinTopup || 0
                        const belowMin = waffoMin > topupAmount
                        const disabledReason = belowMin
                          ? t('Minimum topup amount: {{amount}}', {
                              amount: waffoMin,
                            })
                          : undefined
                        const disabledLabel = belowMin
                          ? `${t('Minimum:')} ${waffoMin}`
                          : undefined

                        let methodIcon = getPaymentIcon('waffo')
                        if (paymentLoading === loadingKey) {
                          methodIcon = (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          )
                        } else if (method.icon) {
                          methodIcon = (
                            <img
                              src={method.icon}
                              alt={method.name}
                              className='h-4 w-4 object-contain'
                            />
                          )
                        }

                        const button = (
                          <Button
                            key={methodKey}
                            variant='outline'
                            onClick={() =>
                              (onWaffoMethodChange ?? onWaffoMethodSelect)?.(
                                method,
                                index
                              )
                            }
                            disabled={belowMin || !!paymentLoading}
                            title={disabledReason}
                            aria-label={
                              disabledReason
                                ? `${method.name}. ${disabledReason}`
                                : method.name
                            }
                            className={cn(
                              'min-h-14 min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left',
                              selectedWaffoMethodIndex === index &&
                                'border-sky-500 bg-sky-50 text-sky-700 hover:bg-sky-50'
                            )}
                          >
                            {methodIcon}
                            <span className='flex min-w-0 flex-col items-start gap-0.5'>
                              <span className='max-w-full truncate'>
                                {method.name}
                              </span>
                              {disabledLabel && (
                                <span className='text-muted-foreground max-w-full truncate text-[11px] leading-4 font-normal'>
                                  {disabledLabel}
                                </span>
                              )}
                            </span>
                          </Button>
                        )

                        return belowMin ? (
                          <TooltipProvider key={methodKey}>
                            <Tooltip>
                              <TooltipTrigger render={button} />
                              <TooltipContent>{disabledReason}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          button
                        )
                      })}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Creem Products Section */}
      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Creem Payment')}
            </Label>
            <CreemProductsSection
              products={creemProducts}
              onProductSelect={onCreemProductSelect}
            />
          </div>
        )}

      {embedded && hasConfigurableTopup && (
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='bg-muted/40 flex items-start gap-3 rounded-2xl p-4'>
            <ShieldCheck
              className='mt-0.5 size-5 shrink-0 text-emerald-500'
              aria-hidden='true'
            />
            <div>
              <p className='text-sm font-medium'>{t('Secure payment')}</p>
              <p className='text-muted-foreground mt-1 text-xs leading-5'>
                {t('Payment and credit amounts are verified by the server')}
              </p>
            </div>
          </div>
          <div className='bg-muted/40 flex items-start gap-3 rounded-2xl p-4'>
            <Clock3
              className='mt-0.5 size-5 shrink-0 text-sky-500'
              aria-hidden='true'
            />
            <div>
              <p className='text-sm font-medium'>{t('Automatic credit')}</p>
              <p className='text-muted-foreground mt-1 text-xs leading-5'>
                {t('Your balance updates automatically after payment')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Redemption Code Section */}
      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
          <div className='flex items-center gap-2'>
            <IconBadge tone='warning' size='xs'>
              <Gift />
            </IconBadge>
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-9 min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-9 px-4'
            >
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              {t('Need a redemption code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                {t('Get one here')}
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert className='border-t'>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
