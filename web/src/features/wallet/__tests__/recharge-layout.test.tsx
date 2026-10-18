import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RechargeFormCard } from '../components/recharge-form-card'
import type { TopupInfo } from '../types'

const topupInfo: TopupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: false,
  pay_methods: [{ name: 'Alipay', type: 'alipay' }],
  min_topup: 25,
  stripe_min_topup: 25,
  amount_options: [25, 100, 450, 1200, 2800],
  discount: {},
}

function renderRecharge(
  overrides: Partial<React.ComponentProps<typeof RechargeFormCard>> = {}
) {
  const props = {
    topupInfo,
    presetAmounts: [
      { value: 25, discount: 0.4 },
      { value: 100, discount: 0.3 },
    ],
    selectedPreset: null,
    topupAmount: 25,
    paymentAmount: 10,
    priceRatio: 1,
    calculating: false,
    paymentLoading: null,
    redemptionCode: '',
    redeeming: false,
    onSelectPreset: vi.fn(),
    onTopupAmountChange: vi.fn(),
    onPaymentMethodSelect: vi.fn(),
    onRedemptionCodeChange: vi.fn(),
    onRedeem: vi.fn(),
    embedded: true,
    hidePaymentMethods: true,
    ...overrides,
  }
  render(<RechargeFormCard {...props} />)
  return props
}

describe('embedded recharge packages', () => {
  it('marks the initial amount selected and shows credit separately from the payment price', () => {
    renderRecharge()
    const first = screen.getByRole('button', { name: /获得 25 美元额度/ })
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(first).toHaveTextContent('¥10')
    expect(first).toHaveTextContent('Automatic credit after payment')
    expect(first).not.toHaveTextContent('OFF')
    expect(screen.getByText('Credit is added in USD')).toBeVisible()
  })

  it('selects the original preset object without changing its amount or discount', () => {
    const props = renderRecharge({ selectedPreset: 100 })
    const selected = screen.getByRole('button', { name: /获得 100 美元额度/ })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /获得 25 美元额度/ })
    ).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(selected)
    expect(props.onSelectPreset).toHaveBeenCalledWith({
      value: 100,
      discount: 0.3,
    })
    expect(props.onPaymentMethodSelect).not.toHaveBeenCalled()
  })

  it('opens QQ support without selecting a package or initiating payment', async () => {
    const props = renderRecharge()
    fireEvent.click(screen.getByRole('button', { name: /Custom recharge/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'QQ group: 603378289'
    )
    expect(
      screen.getByRole('img', { name: 'QQ support group QR code' })
    ).toHaveAttribute('src', '/wukongai-group-qr.png')
    expect(props.onSelectPreset).not.toHaveBeenCalled()
    expect(props.onPaymentMethodSelect).not.toHaveBeenCalled()
  })

  it('keeps redemption available alongside the new safety and credit notices', () => {
    const props = renderRecharge()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'redeem-example' },
    })
    expect(props.onRedemptionCodeChange).toHaveBeenCalledWith('redeem-example')
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }))
    expect(props.onRedeem).toHaveBeenCalledOnce()
    expect(
      screen.getByText('Payment and credit amounts are verified by the server')
    ).toBeVisible()
    expect(
      screen.getByText('Your balance updates automatically after payment')
    ).toBeVisible()
  })
})
