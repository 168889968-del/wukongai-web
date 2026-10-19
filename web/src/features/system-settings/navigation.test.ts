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
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { getAuthSectionNavItems as originalAuth } from './auth/section-registry'
import { getBillingSectionNavItems as originalBilling } from './billing/section-registry'
import { getContentSectionNavItems as originalContent } from './content/section-registry'
import { getModelsSectionNavItems as originalModels } from './models/section-registry'
import * as navigation from './navigation'
import { getOperationsSectionNavItems as originalOperations } from './operations/section-registry'
import { getPolicySectionNavItems as originalPolicy } from './request-policies/section-registry'
import { getSecuritySectionNavItems as originalSecurity } from './security/section-registry'
import { getSiteSectionNavItems as originalSite } from './site/section-registry'

const translate = ((key: string) => key) as TFunction
describe('settings navigation without eager form imports', () => {
  it('auth keeps every existing settings destination', () => {
    expect(navigation.getAuthSectionNavItems(translate)).toEqual(
      originalAuth(translate)
    )
  })
  it('billing keeps every existing settings destination', () => {
    expect(navigation.getBillingSectionNavItems(translate)).toEqual(
      originalBilling(translate)
    )
  })
  it('content keeps every existing settings destination', () => {
    expect(navigation.getContentSectionNavItems(translate)).toEqual(
      originalContent(translate)
    )
  })
  it('models keeps every existing settings destination', () => {
    expect(navigation.getModelsSectionNavItems(translate)).toEqual(
      originalModels(translate)
    )
  })
  it('operations keeps every existing settings destination', () => {
    expect(navigation.getOperationsSectionNavItems(translate)).toEqual(
      originalOperations(translate)
    )
  })
  it('request-policies keeps every existing settings destination', () => {
    expect(navigation.getPolicySectionNavItems(translate)).toEqual(
      originalPolicy(translate)
    )
  })
  it('security keeps every existing settings destination', () => {
    expect(navigation.getSecuritySectionNavItems(translate)).toEqual(
      originalSecurity(translate)
    )
  })
  it('site keeps every existing settings destination', () => {
    expect(navigation.getSiteSectionNavItems(translate)).toEqual(
      originalSite(translate)
    )
  })
})
