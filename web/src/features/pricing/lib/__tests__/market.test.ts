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
import { describe, expect, it } from 'vitest'

import type { PricingModel } from '../../types'
import {
  filterMarketModels,
  getStatusBars,
  getStatusLevel,
  type MarketFilterOptions,
  type MarketPerf,
} from '../market'
import { extractSvg } from '../pelican'

function model(
  name: string,
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: 1,
    model_name: name,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

function perf(successRate: number, requests: number): MarketPerf {
  return { successRate, requests, series: [] }
}

const models = [
  model('alpha', { vendor_name: 'OpenAI', model_ratio: 3, id: 1 }),
  model('beta', {
    vendor_name: 'Anthropic',
    model_ratio: 1,
    id: 2,
    enable_groups: ['default', 'vip'],
  }),
  model('gamma', { vendor_name: 'Google', model_ratio: 2, id: 3 }),
]

const base: MarketFilterOptions = {
  search: '',
  vendors: [],
  statuses: [],
  group: 'default',
  sort: 'hot',
  perf: new Map([
    ['alpha', perf(99.9, 5)],
    ['beta', perf(95, 50)],
    ['gamma', perf(40, 1)],
  ]),
}

const names = (list: PricingModel[]) => list.map((m) => m.model_name)

describe('model market filters', () => {
  it('grades success rates into normal, busy and maintenance', () => {
    expect(getStatusLevel(99)).toBe('ok')
    expect(getStatusLevel(90)).toBe('warn')
    expect(getStatusLevel(89.9)).toBe('bad')
    expect(getStatusLevel(undefined)).toBeNull()
  })

  it('pads status bars on the left and keeps the latest 24 samples', () => {
    const bars = getStatusBars([
      { ts: 2, success_rate: 50 },
      { ts: 1, success_rate: 100 },
    ])
    expect(bars).toHaveLength(24)
    expect(bars.slice(-3)).toEqual([null, 'ok', 'bad'])
    const full = getStatusBars(
      Array.from({ length: 30 }, (_, ts) => ({ ts, success_rate: 100 }))
    )
    expect(full.every((bar) => bar === 'ok')).toBe(true)
  })

  it('sorts popular models by 24h traffic, by input price and by newest', () => {
    expect(names(filterMarketModels(models, base))).toEqual([
      'beta',
      'alpha',
      'gamma',
    ])
    expect(
      names(filterMarketModels(models, { ...base, sort: 'price' }))
    ).toEqual(['beta', 'gamma', 'alpha'])
    expect(names(filterMarketModels(models, { ...base, sort: 'new' }))).toEqual(
      ['gamma', 'beta', 'alpha']
    )
  })

  it('combines multi-vendor, status, group and search filters', () => {
    expect(
      names(
        filterMarketModels(models, { ...base, vendors: ['OpenAI', 'Google'] })
      )
    ).toEqual(['alpha', 'gamma'])
    expect(
      names(filterMarketModels(models, { ...base, statuses: ['warn', 'bad'] }))
    ).toEqual(['beta', 'gamma'])
    expect(
      names(filterMarketModels(models, { ...base, group: 'vip' }))
    ).toEqual(['beta'])
    expect(
      names(filterMarketModels(models, { ...base, search: ' GOOGLE ' }))
    ).toEqual(['gamma'])
  })

  it('extracts the first SVG element from model output', () => {
    expect(
      extractSvg('Here:\n```svg\n<svg viewBox="0 0 1 1"><g/></svg>\n```')
    ).toBe('<svg viewBox="0 0 1 1"><g/></svg>')
    expect(extractSvg('no drawing')).toBeNull()
  })
})
