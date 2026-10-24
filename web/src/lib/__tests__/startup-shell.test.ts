import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const template = readFileSync('index.html', 'utf8')
const script = template.match(
  /<script id="startup-script">([\s\S]*?)<\/script>/
)?.[1]

describe('startup shell on a slow connection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute('data-app-ready')
    document.documentElement.removeAttribute('data-app-styles-ready')
    document.head.innerHTML =
      '<link data-app-stylesheet rel="preload" as="style">'
    document.body.innerHTML = template
      .split('<body>')[1]
      .split('<script id="startup-script">')[0]
    if (!script) throw new Error('Startup script missing')
    window.eval(script)
  })

  afterEach(async () => {
    document.documentElement.setAttribute('data-app-styles-ready', 'true')
    const root = document.querySelector('#root')
    if (root) root.textContent = 'Ready'
    await Promise.resolve()
    vi.useRealTimers()
  })

  it('keeps navigation visible while scripts are delayed and offers retry', () => {
    expect(
      document.querySelector('#startup-shell a[href="/get-started"]')
    ).not.toBeNull()
    expect(
      document.querySelector('#startup-shell a[href="/sign-in"]')
    ).not.toBeNull()
    vi.advanceTimersByTime(15000)
    expect(document.querySelector('#startup-status')?.textContent).toContain(
      '当前网络较慢'
    )
    expect(
      (document.querySelector('#startup-retry') as HTMLButtonElement).hidden
    ).toBe(false)
  })

  it('waits for both application content and CSS before removing the shell', async () => {
    const root = document.querySelector('#root')
    if (!root) throw new Error('Application root missing')
    root.textContent = 'Application ready'
    await Promise.resolve()
    expect(document.querySelector('#startup-shell')).not.toBeNull()
    document.documentElement.setAttribute('data-app-styles-ready', 'true')
    await Promise.resolve()
    expect(document.querySelector('#startup-shell')).toBeNull()
    expect(document.documentElement.getAttribute('data-app-ready')).toBe('true')
    vi.advanceTimersByTime(15000)
  })

  it('keeps the shell when CSS is ready but the route is still pending', async () => {
    document.documentElement.setAttribute('data-app-styles-ready', 'true')
    await Promise.resolve()
    expect(document.querySelector('#startup-shell')).not.toBeNull()
    expect(document.documentElement.hasAttribute('data-app-ready')).toBe(false)
  })
})
