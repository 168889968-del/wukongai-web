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
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { getHomePageContent } from '../api'
import { useHomePageContent } from './use-home-page-content'

vi.mock('../api', () => ({ getHomePageContent: vi.fn() }))
afterEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

it('shows the default home while an optional request never resolves', () => {
  vi.mocked(getHomePageContent).mockReturnValue(new Promise(() => {}))
  const { result, unmount } = renderHook(useHomePageContent)
  expect(result.current).toEqual({ content: '', isLoaded: true, isUrl: false })
  const signal = vi.mocked(getHomePageContent).mock.calls[0][0]
  unmount()
  expect(signal?.aborted).toBe(true)
})

it('shows cached custom content immediately and preserves it on network failure', async () => {
  localStorage.setItem('home_page_content', 'https://example.com/home')
  vi.mocked(getHomePageContent).mockRejectedValue(new Error('timeout'))
  const { result } = renderHook(useHomePageContent)
  expect(result.current.content).toBe('https://example.com/home')
  await act(async () => {})
  expect(result.current).toEqual({
    content: 'https://example.com/home',
    isLoaded: true,
    isUrl: true,
  })
})

it('replaces a stale custom home when the server clears it', async () => {
  localStorage.setItem('home_page_content', 'old home')
  vi.mocked(getHomePageContent).mockResolvedValue({ success: true, data: '' })
  const { result } = renderHook(useHomePageContent)
  await waitFor(() => expect(result.current.content).toBe(''))
  expect(localStorage.getItem('home_page_content')).toBeNull()
})
