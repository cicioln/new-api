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

import {
  aggregateOverview,
  buildOverviewWindow,
  foldModelShare,
  getGreetingKey,
  getPeriodChange,
} from '../overview'

const now = new Date('2026-10-24T14:30:00').getTime() / 1000

describe('buildOverviewWindow', () => {
  it('uses 24 hourly buckets ending in the current hour for 24h', () => {
    const window = buildOverviewWindow('24h', now)
    expect(window.bucketStarts).toHaveLength(24)
    expect(window.bucketStarts.at(-1)).toBe(
      new Date('2026-10-24T14:00:00').getTime() / 1000
    )
    expect(window.start - window.previousStart).toBe(24 * 3600)
  })

  it('uses 14 half-day buckets ending in the current half day for 7d', () => {
    const window = buildOverviewWindow('7d', now)
    expect(window.bucketStarts).toHaveLength(14)
    expect(window.bucketStarts.at(-1)).toBe(
      new Date('2026-10-24T12:00:00').getTime() / 1000
    )
    expect(window.start).toBe(new Date('2026-10-18T00:00:00').getTime() / 1000)
    expect(window.previousStart).toBe(
      new Date('2026-10-11T00:00:00').getTime() / 1000
    )
  })
})

describe('aggregateOverview', () => {
  const window = buildOverviewWindow('7d', now)
  const day = (date: string) => new Date(date).getTime() / 1000

  it('splits rows into current and previous periods and buckets the current one', () => {
    const result = aggregateOverview(
      [
        {
          created_at: day('2026-10-12T10:00:00'),
          model_name: 'a',
          count: 4,
          quota: 40,
          token_used: 400,
        },
        {
          created_at: day('2026-10-18T09:00:00'),
          model_name: 'a',
          count: 2,
          quota: 10,
          token_used: 100,
        },
        {
          created_at: day('2026-10-24T13:00:00'),
          model_name: 'b',
          count: 3,
          quota: 30,
          token_used: 300,
        },
      ],
      window
    )

    expect(result.previous).toEqual({ count: 4, quota: 40, tokens: 400 })
    expect(result.current).toEqual({ count: 5, quota: 40, tokens: 400 })
    expect(result.series.count).toEqual([
      2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3,
    ])
    expect(result.models.map((model) => model.modelName)).toEqual(['b', 'a'])
  })

  it('ignores rows outside both periods', () => {
    const result = aggregateOverview(
      [{ created_at: day('2026-10-01T00:00:00'), count: 9, quota: 9 }],
      window
    )
    expect(result.current.count).toBe(0)
    expect(result.previous.count).toBe(0)
    expect(result.models).toEqual([])
  })
})

describe('getPeriodChange', () => {
  it('returns null without a previous baseline', () => {
    expect(getPeriodChange(10, 0)).toBeNull()
  })

  it('returns the signed percentage change', () => {
    expect(getPeriodChange(150, 100)).toBe(50)
    expect(getPeriodChange(50, 100)).toBe(-50)
  })
})

describe('foldModelShare', () => {
  it('folds models beyond the limit into one remainder', () => {
    const share = foldModelShare(
      [
        { modelName: 'a', quota: 5, count: 1 },
        { modelName: 'b', quota: 3, count: 1 },
        { modelName: 'c', quota: 2, count: 1 },
      ],
      1
    )
    expect(share.items.map((model) => model.modelName)).toEqual(['a'])
    expect(share.otherCount).toBe(2)
    expect(share.other).toBe(5)
  })
})

describe('getGreetingKey', () => {
  it.each([
    [3, 'Good evening, {{name}}'],
    [9, 'Good morning, {{name}}'],
    [14, 'Good afternoon, {{name}}'],
    [21, 'Good evening, {{name}}'],
  ])('maps hour %i to %s', (hour, key) => {
    expect(getGreetingKey(hour)).toBe(key)
  })
})
