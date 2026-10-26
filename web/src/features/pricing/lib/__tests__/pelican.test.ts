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

import { beforeEach, describe, expect, it } from 'vitest'

import {
  loadPelicanHistory,
  savePelicanHistory,
  type PelicanRecord,
} from '../pelican'

const record: PelicanRecord = {
  id: 'r1',
  model: 'gpt-test',
  prompt: 'p',
  group: 'default',
  svg: '<svg></svg>',
  createdAt: 1,
  totalMs: 10,
}

describe('pelican history storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps records private to each user', () => {
    savePelicanHistory([record], 1)
    expect(loadPelicanHistory(1)).toEqual([record])
    expect(loadPelicanHistory(2)).toEqual([])
    expect(loadPelicanHistory()).toEqual([])
  })

  it('drops the legacy history shared by all accounts', () => {
    window.localStorage.setItem(
      'pricing-pelican-history',
      JSON.stringify([record])
    )
    expect(loadPelicanHistory(1)).toEqual([])
    expect(window.localStorage.getItem('pricing-pelican-history')).toBeNull()
  })
})
