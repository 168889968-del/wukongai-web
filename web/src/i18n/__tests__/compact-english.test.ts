import { createRequire } from 'node:module'

import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

import en from '../locales/en.json'

const require = createRequire(import.meta.url)
const compactEnglish = require('../../../scripts/compact-english-loader.cjs')

describe('compact English runtime dictionary', () => {
  it('preserves every English translation and interpolation', async () => {
    const output = compactEnglish(JSON.stringify(en)) as string
    const compact = JSON.parse(output.replace('export default ', ''))
    const fullInstance = createInstance()
    const compactInstance = createInstance()
    const options = {
      lng: 'en',
      fallbackLng: 'en',
      nsSeparator: false as const,
    }
    await fullInstance.init({ ...options, resources: { en } })
    await compactInstance.init({ ...options, resources: { en: compact } })
    for (const key of Object.keys(en.translation)) {
      for (const count of [1, 2]) {
        const values = { count, name: 'Example', value: '42' }
        expect(compactInstance.t(key, values), key).toBe(
          fullInstance.t(key, values)
        )
      }
    }
    expect(output.length).toBeLessThan(JSON.stringify(en).length / 10)
  })
})
