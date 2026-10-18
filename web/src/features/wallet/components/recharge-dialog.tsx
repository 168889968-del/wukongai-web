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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from '../constants'
import {
  useTopupInfo,
  usePayment,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from '../hooks'
import {
  formatCurrency,
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
  getPaymentIcon,
} from '../lib'
import type {
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemConfirmDialog } from './dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './dialogs/payment-confirm-dialog'
import { RechargeFormCard } from './recharge-form-card'

interface RechargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful payment or redemption, e.g. to refresh balance */
  onSuccess?: () => void | Promise<void>
  onOpenBilling?: () => void
  username?: string
}

/**
 * Account recharge dialog. Self-contained so it can be opened from the
 * wallet page and from the site header without navigating away.
 */
export function RechargeDialog(props: RechargeDialogProps) {
  const { t } = useTranslation()
  const authUser = useAuthStore((state) => state.auth.user)
  const username = props.username || authUser?.username
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)

  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  // Calculate effective exchange rate - when display type is USD, use rate of 1
  const effectiveUsdExchangeRate = useMemo(() => {
    return currency?.quotaDisplayType === 'USD'
      ? 1
      : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, currency?.usdExchangeRate])
  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  // Initialize topup amount when topup info is loaded
  const topupAmountInitializedRef = useRef(false)
  useEffect(() => {
    if (topupInfo && !topupAmountInitializedRef.current) {
      topupAmountInitializedRef.current = true
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      const defaultMethod = topupInfo.pay_methods?.[0]
      if (defaultMethod) setSelectedPaymentMethod(defaultMethod)
      else if (topupInfo.waffo_pay_methods?.[0]) {
        const method = topupInfo.waffo_pay_methods[0]
        setSelectedPaymentMethod({
          name: method.name,
          type: PAYMENT_TYPES.WAFFO,
          icon: method.icon,
        })
        setSelectedWaffoMethodIndex(0)
      } else if (defaultPaymentType === PAYMENT_TYPES.STRIPE) {
        setSelectedPaymentMethod({ name: 'Stripe', type: PAYMENT_TYPES.STRIPE })
      }
      calculatePaymentAmount(minTopup, defaultPaymentType)
    }
  }, [topupInfo, calculatePaymentAmount])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    if (method.type !== PAYMENT_TYPES.WAFFO) {
      setSelectedWaffoMethodIndex(null)
    }
    setPaymentLoading(method.type)

    try {
      // Validate minimum topup
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) {
        return
      }

      // Calculate payment amount and show confirmation dialog
      await calculatePaymentAmount(topupAmount, method.type)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const success = await dispatchSelectedPayment(
      selectedPaymentMethod,
      topupAmount,
      selectedWaffoMethodIndex,
      {
        regular: processPayment,
        waffo: processWaffoPayment,
        waffoPancake: processWaffoPancakePayment,
      }
    )

    if (success) {
      setConfirmDialogOpen(false)
      props.onOpenChange(false)
      await props.onSuccess?.()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await props.onSuccess?.()
    }
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      props.onOpenChange(false)
      setSelectedCreemProduct(null)
      await props.onSuccess?.()
    }
  }

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setSelectedWaffoMethodIndex(null)
    calculatePaymentAmount(topupAmount, method.type)
  }

  const handleWaffoMethodSelect = async (
    method: WaffoPayMethod,
    index: number
  ) => {
    const loadingKey = `waffo-${index}`
    setSelectedPaymentMethod({
      name: method.name,
      type: PAYMENT_TYPES.WAFFO,
      icon: method.icon,
    })
    setSelectedWaffoMethodIndex(index)
    setPaymentLoading(loadingKey)

    try {
      await calculatePaymentAmount(topupAmount, PAYMENT_TYPES.WAFFO)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Account Recharge')}
        description={t('Choose an amount and payment method')}
        contentHeight='min(88dvh, 800px)'
        contentClassName='max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl sm:p-0 xl:max-w-7xl'
        headerClassName='sr-only'
        bodyClassName='h-full px-0 py-0'
      >
        <div className='grid min-h-full gap-0 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_320px]'>
          <div className='min-w-0 px-4 py-5 sm:px-7 sm:py-6 lg:min-h-0 lg:overflow-y-auto'>
            <div className='mb-6 flex items-center justify-between gap-4 border-b pr-7 pb-5 text-sm lg:pr-0'>
              <span className='text-muted-foreground'>
                {t('Recharge Account')}
              </span>
              <span className='font-medium'>{username || '—'}</span>
            </div>
            <RechargeFormCard
              topupInfo={topupInfo}
              presetAmounts={presetAmounts}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              topupAmount={topupAmount}
              onTopupAmountChange={handleTopupAmountChange}
              paymentAmount={paymentAmount}
              calculating={calculating}
              onPaymentMethodSelect={handlePaymentMethodSelect}
              onPaymentMethodChange={handlePaymentMethodChange}
              selectedPaymentMethod={selectedPaymentMethod}
              paymentLoading={paymentLoading}
              redemptionCode={redemptionCode}
              onRedemptionCodeChange={setRedemptionCode}
              onRedeem={handleRedeem}
              redeeming={redeeming}
              topupLink={topupInfo?.topup_link}
              loading={topupLoading}
              priceRatio={(status?.price as number) || 1}
              usdExchangeRate={effectiveUsdExchangeRate}
              onOpenBilling={props.onOpenBilling}
              creemProducts={topupInfo?.creem_products}
              enableCreemTopup={topupInfo?.enable_creem_topup}
              onCreemProductSelect={handleCreemProductSelect}
              enableWaffoTopup={topupInfo?.enable_waffo_topup}
              waffoPayMethods={topupInfo?.waffo_pay_methods}
              waffoMinTopup={topupInfo?.waffo_min_topup}
              onWaffoMethodChange={handleWaffoMethodSelect}
              selectedWaffoMethodIndex={selectedWaffoMethodIndex}
              enableWaffoPancakeTopup={topupInfo?.enable_waffo_pancake_topup}
              embedded
              hidePaymentMethods
            />
          </div>
          <aside className='bg-muted/30 flex flex-col border-t p-5 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:pt-10'>
            <div className='text-center'>
              <p className='text-muted-foreground text-sm'>{t('Amount Due')}</p>
              <p className='mt-3 text-4xl font-semibold tracking-tight text-sky-500'>
                <span className='mr-1 text-lg'>¥</span>
                {formatCurrency(paymentAmount)}
              </p>
              <p className='text-muted-foreground mt-2 text-sm'>
                {t('{{amount}} 美元额度', {
                  amount: formatNumber(topupAmount),
                })}
              </p>
            </div>
            <div className='my-5 border-t' />
            <div className='space-y-2.5'>
              <p className='text-sm font-medium'>{t('Payment Method')}</p>
              <div className='grid grid-cols-2 gap-2'>
                {topupInfo?.pay_methods?.map((method) => {
                  const minimum = Math.max(
                    method.min_topup || 0,
                    getMinTopupAmount(topupInfo)
                  )
                  const selected = selectedPaymentMethod?.type === method.type
                  return (
                    <button
                      key={method.type}
                      type='button'
                      aria-pressed={selected}
                      disabled={
                        minimum > topupAmount || paymentLoading !== null
                      }
                      onClick={() => handlePaymentMethodChange(method)}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selected ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {getPaymentIcon(
                        method.type,
                        'size-4 shrink-0',
                        method.icon,
                        method.name
                      )}
                      <span className='truncate'>{method.name}</span>
                    </button>
                  )
                })}
                {topupInfo?.enable_stripe_topup &&
                  !topupInfo.pay_methods?.some(
                    (method) => method.type === PAYMENT_TYPES.STRIPE
                  ) && (
                    <button
                      type='button'
                      aria-pressed={
                        selectedPaymentMethod?.type === PAYMENT_TYPES.STRIPE
                      }
                      onClick={() =>
                        handlePaymentMethodChange({
                          name: 'Stripe',
                          type: PAYMENT_TYPES.STRIPE,
                        })
                      }
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selectedPaymentMethod?.type === PAYMENT_TYPES.STRIPE ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'}`}
                    >
                      {getPaymentIcon(PAYMENT_TYPES.STRIPE, 'size-4 shrink-0')}
                      <span>Stripe</span>
                    </button>
                  )}
                {topupInfo?.enable_waffo_topup &&
                  topupInfo.waffo_pay_methods?.map((method, index) => {
                    const selected =
                      selectedPaymentMethod?.type === PAYMENT_TYPES.WAFFO &&
                      selectedWaffoMethodIndex === index
                    const disabled =
                      (topupInfo.waffo_min_topup || 0) > topupAmount
                    return (
                      <button
                        key={`${method.payMethodType ?? 'waffo'}-${method.payMethodName ?? method.name}`}
                        type='button'
                        aria-pressed={selected}
                        disabled={disabled || paymentLoading !== null}
                        onClick={() => handleWaffoMethodSelect(method, index)}
                        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selected ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {method.icon ? (
                          <img
                            src={method.icon}
                            alt=''
                            className='size-4 shrink-0 object-contain'
                          />
                        ) : (
                          getPaymentIcon(PAYMENT_TYPES.WAFFO, 'size-4 shrink-0')
                        )}
                        <span className='truncate'>{method.name}</span>
                      </button>
                    )
                  })}
              </div>
              {!topupInfo?.pay_methods?.length &&
                !topupInfo?.enable_stripe_topup &&
                !(
                  topupInfo?.enable_waffo_topup &&
                  topupInfo.waffo_pay_methods?.length
                ) && (
                  <p className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800'>
                    {t(
                      'No payment methods available. Please contact administrator.'
                    )}
                  </p>
                )}
            </div>
            <div className='min-h-8 flex-1' />
            <Button
              className='mt-4 h-11 rounded-full bg-sky-500 text-base font-semibold text-white hover:bg-sky-600'
              disabled={
                calculating || paymentLoading !== null || !selectedPaymentMethod
              }
              onClick={() =>
                selectedPaymentMethod &&
                handlePaymentMethodSelect(selectedPaymentMethod)
              }
            >
              {t('Continue to payment')}
            </Button>
            <p className='text-muted-foreground mt-3 text-center text-[11px] leading-5'>
              {t('支付完成后额度自动到账，可在「订单记录」中查看每一笔充值。')}
            </p>
          </aside>
        </div>
      </Dialog>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || waffoProcessing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}
