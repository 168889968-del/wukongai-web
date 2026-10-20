import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { getUserModels } from '@/lib/api'

import { QuickSetupDialog } from '../quick-setup-dialog'

vi.mock('@/features/keys/api', () => ({
  getApiKeys: vi.fn(async () => ({
    success: true,
    data: { items: [{ id: 1, name: 'Test key', status: 1 }] },
  })),
  fetchTokenKey: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ getUserModels: vi.fn() }))
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    select: (state: { auth: { user: { id: number } } }) => unknown
  ) => select({ auth: { user: { id: 1 } } }),
}))
vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))
vi.mock('@/features/keys/components/dialogs/cc-switch-dialog', () => ({
  CCSwitchDialog: () => null,
}))

afterEach(cleanup)

async function showClaudeSetup(models: string[]) {
  vi.mocked(getUserModels).mockResolvedValue({ success: true, data: models })
  const i18n = createInstance()
  await i18n.init({
    lng: 'zhCN',
    fallbackLng: 'zhCN',
    resources: { zhCN: zh },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={query}>
      <I18nextProvider i18n={i18n}>
        <QuickSetupDialog
          open
          onOpenChange={vi.fn()}
          initialClient='claude'
          initialOs='windows'
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
  await screen.findByRole('button', { name: 'Test key' })
  return userEvent.setup()
}

it('excludes GPT from Claude model choices without a standalone warning', async () => {
  const user = await showClaudeSetup(['gpt-6.1-sol', 'claude-sonnet-5-5'])
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await user.click(screen.getByRole('combobox', { name: '模型' }))
  expect(
    await screen.findByRole('option', { name: 'claude-sonnet-5-5' })
  ).toBeVisible()
  expect(
    screen.queryByRole('option', { name: 'gpt-6.1-sol' })
  ).not.toBeInTheDocument()
})

it('explains why no compatible model is available and prevents a download', async () => {
  const user = await showClaudeSetup(['gpt-6.1-sol'])
  expect(screen.getByRole('button', { name: '下载配置工具' })).toBeDisabled()
  await user.click(screen.getByRole('combobox', { name: '模型' }))
  expect(
    await screen.findByText(
      '暂无兼容的 Claude 模型，请检查账号和 API 密钥的模型权限。'
    )
  ).toBeVisible()
})
