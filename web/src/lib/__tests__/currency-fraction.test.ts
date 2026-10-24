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
import { afterEach, beforeEach, expect, it } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { formatCurrencyFromUSD } from '../currency'

beforeEach(() => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'USD',
    },
  })
})

afterEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

it('drops trailing zeros by default', () => {
  expect(
    formatCurrencyFromUSD(128.4, { abbreviate: false, locale: 'en-US' })
  ).toBe('$128.4')
})

it('keeps the requested minimum fraction digits', () => {
  expect(
    formatCurrencyFromUSD(128.4, {
      abbreviate: false,
      digitsSmall: 2,
      minimumFractionDigits: 2,
      locale: 'en-US',
    })
  ).toBe('$128.40')
  expect(
    formatCurrencyFromUSD(0, { minimumFractionDigits: 2, locale: 'en-US' })
  ).toBe('$0.00')
})
