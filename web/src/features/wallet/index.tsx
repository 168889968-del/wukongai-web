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
import { Clock3, QrCode, ShieldCheck } from 'lucide-react'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getSelf } from '@/lib/api'
import { formatNumber } from '@/lib/format'

import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { formatCurrency } from './lib'
import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from './hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
  getPaymentIcon,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WaffoPayMethod,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)

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
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('topup') !== '1') return
    setRechargeDialogOpen(true)
    params.delete('topup')
    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    )
  }, [])

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
      setRechargeDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
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
      setRechargeDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
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

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard
              user={user}
              loading={userLoading}
              onRecharge={() => setRechargeDialogOpen(true)}
              onOpenBilling={() => setBillingDialogOpen(true)}
            />

            <div
              className='grid gap-4'
            >
              <div className='flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6'>
                <div>
                  <h2 className='font-semibold'>{t('Top-up and orders')}</h2>
                  <p className='mt-1 text-sm text-muted-foreground'>{t('Select a package and payment method, or review your transaction history.')}</p>
                </div>
                <div className='flex gap-2'>
                  <Button variant='outline' className='rounded-full' onClick={() => setBillingDialogOpen(true)}>{t('Order History')}</Button>
                  <Button className='rounded-full bg-sky-500 text-white hover:bg-sky-600' onClick={() => setRechargeDialogOpen(true)}>{t('Account Recharge')}</Button>
                </div>
              </div>

              {showSubscriptionPanel && <SubscriptionPlansCard
                  topupInfo={topupInfo}
                  onAvailabilityChange={handleSubscriptionAvailabilityChange}
                  userQuota={user?.quota}
                  onPurchaseSuccess={fetchUser}
                />}
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog
        open={rechargeDialogOpen}
        onOpenChange={setRechargeDialogOpen}
        title={t('Account Recharge')}
        description={t('Choose an amount and payment method')}
        contentHeight='min(76vh, 720px)'
        contentClassName='max-w-6xl overflow-hidden p-0 sm:p-0'
        headerClassName='sr-only'
        bodyClassName='px-0 py-0'
      >
        <div className='grid min-h-[min(76vh,720px)] gap-0 lg:grid-cols-[minmax(0,1fr)_340px]'>
          <div className='min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5'>
            <div className='mb-4 flex items-center justify-between border-b border-slate-200 pb-4 text-sm'>
              <span className='text-muted-foreground'>{t('Recharge Account')}</span>
              <span className='font-medium'>{user?.username || '—'}</span>
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
              onOpenBilling={() => setBillingDialogOpen(true)}
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
          <aside className='flex min-h-0 flex-col border-t bg-slate-50/80 p-5 sm:p-6 lg:border-t-0 lg:border-l'>
            <div className='text-center'>
              <p className='text-sm text-muted-foreground'>{t('Amount Due')}</p>
              <p className='mt-1 font-mono text-4xl font-bold tracking-tight text-sky-500'>{formatCurrency(paymentAmount)}</p>
              <p className='mt-2 text-sm text-muted-foreground'>{formatNumber(topupAmount)} {t('Quota will be credited after successful payment')}</p>
            </div>
            <div className='my-5 border-t' />
            <div className='space-y-2.5'>
              <p className='text-sm font-medium'>{t('Payment Method')}</p>
              <div className='grid grid-cols-2 gap-2'>
                {topupInfo?.pay_methods?.map((method) => {
                  const minimum = Math.max(method.min_topup || 0, getMinTopupAmount(topupInfo))
                  const selected = selectedPaymentMethod?.type === method.type
                  return (
                    <button
                      key={method.type}
                      type='button'
                      aria-pressed={selected}
                      disabled={minimum > topupAmount || paymentLoading !== null}
                      onClick={() => handlePaymentMethodChange(method)}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selected ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {getPaymentIcon(method.type, 'size-4 shrink-0', method.icon, method.name)}
                      <span className='truncate'>{method.name}</span>
                    </button>
                  )
                })}
                {topupInfo?.enable_stripe_topup && !topupInfo.pay_methods?.some((method) => method.type === PAYMENT_TYPES.STRIPE) && (
                  <button
                    type='button'
                    aria-pressed={selectedPaymentMethod?.type === PAYMENT_TYPES.STRIPE}
                    onClick={() => handlePaymentMethodChange({ name: 'Stripe', type: PAYMENT_TYPES.STRIPE })}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selectedPaymentMethod?.type === PAYMENT_TYPES.STRIPE ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'}`}
                  >
                    {getPaymentIcon(PAYMENT_TYPES.STRIPE, 'size-4 shrink-0')}
                    <span>Stripe</span>
                  </button>
                )}
                {topupInfo?.enable_waffo_topup && topupInfo.waffo_pay_methods?.map((method, index) => {
                  const selected = selectedPaymentMethod?.type === PAYMENT_TYPES.WAFFO && selectedWaffoMethodIndex === index
                  const disabled = (topupInfo.waffo_min_topup || 0) > topupAmount
                  return (
                    <button
                      key={`${method.payMethodType ?? 'waffo'}-${method.payMethodName ?? method.name}`}
                      type='button'
                      aria-pressed={selected}
                      disabled={disabled || paymentLoading !== null}
                      onClick={() => handleWaffoMethodSelect(method, index)}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${selected ? 'border-sky-400 bg-white text-sky-700 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-200'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {method.icon ? <img src={method.icon} alt='' className='size-4 shrink-0 object-contain' /> : getPaymentIcon(PAYMENT_TYPES.WAFFO, 'size-4 shrink-0')}
                      <span className='truncate'>{method.name}</span>
                    </button>
                  )
                })}
              </div>
              {!topupInfo?.pay_methods?.length && !topupInfo?.enable_stripe_topup && !(topupInfo?.enable_waffo_topup && topupInfo.waffo_pay_methods?.length) && (
                <p className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800'>{t('No payment methods available. Please contact administrator.')}</p>
              )}
            </div>
            <div className='mt-4 flex-1 rounded-2xl border border-dashed border-sky-200 bg-white px-4 py-6 text-center'>
              <QrCode className='mx-auto size-9 text-sky-500' />
              <p className='mt-3 text-sm font-medium'>{selectedPaymentMethod?.name ?? t('Choose a payment method')}</p>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>{t('The payment QR code will appear on the secure checkout page.')}</p>
            </div>
            <Button
              className='mt-4 h-11 rounded-full bg-sky-500 text-base font-semibold text-white hover:bg-sky-600'
              disabled={calculating || paymentLoading !== null || !selectedPaymentMethod}
              onClick={() => selectedPaymentMethod && handlePaymentMethodSelect(selectedPaymentMethod)}
            >
              {t('Continue to payment')}
            </Button>
            <div className='mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
              <div className='flex items-center gap-2 rounded-xl bg-white p-3'><ShieldCheck className='size-4 text-emerald-500' />{t('Secure payment')}</div>
              <div className='flex items-center gap-2 rounded-xl bg-white p-3'><Clock3 className='size-4 text-sky-500' />{t('Automatic credit')}</div>
            </div>
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

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
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
