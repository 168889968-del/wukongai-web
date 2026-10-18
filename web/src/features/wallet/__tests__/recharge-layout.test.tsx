import {
  fireEvent,
  render,
  screen,
  type RenderOptions,
} from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

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
  overrides: Partial<React.ComponentProps<typeof RechargeFormCard>> = {},
  options?: RenderOptions
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
  render(<RechargeFormCard {...props} />, options)
  return props
}

describe('embedded recharge packages', () => {
  it('loads Chinese package labels from the real application translation namespace', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'zhCN',
      fallbackLng: 'en',
      resources: { en, zhCN: zh },
      nsSeparator: false,
      interpolation: { escapeValue: false },
    })
    renderRecharge(
      {},
      {
        wrapper: ({ children }) => (
          <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        ),
      }
    )
    expect(screen.getByText('充值套餐')).toBeVisible()
    expect(screen.getByText('额度以美元计入账户')).toBeVisible()
    expect(screen.getByRole('button', { name: /大额定制/ })).toBeVisible()
    expect(screen.queryByText('Recharge packages')).not.toBeInTheDocument()
  })
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
