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
  buildBoardWindow,
  getPeakHour,
  rankModelsByCount,
  stackByModel,
} from '../board'

const now = new Date('2026-10-24T14:30:00').getTime() / 1000
const at = (date: string) => new Date(date).getTime() / 1000

describe('buildBoardWindow', () => {
  it('uses hourly buckets of the current day for today', () => {
    const window = buildBoardWindow('today', now)
    expect(window.bucketStarts).toHaveLength(24)
    expect(window.start).toBe(at('2026-10-24T00:00:00'))
    expect(window.previousStart).toBe(at('2026-10-23T00:00:00'))
  })

  it('uses seven calendar days ending today for 7d', () => {
    const window = buildBoardWindow('7d', now)
    expect(window.bucketStarts).toHaveLength(7)
    expect(window.start).toBe(at('2026-10-18T00:00:00'))
    expect(window.bucketStarts.at(-1)).toBe(at('2026-10-24T00:00:00'))
    expect(window.previousStart).toBe(at('2026-10-11T00:00:00'))
  })
})

describe('stackByModel', () => {
  it('splits spend per bucket into the given models and the rest', () => {
    const window = buildBoardWindow('7d', now)
    const stack = stackByModel(
      [
        { created_at: at('2026-10-18T09:00:00'), model_name: 'a', quota: 4 },
        { created_at: at('2026-10-18T10:00:00'), model_name: 'b', quota: 2 },
        { created_at: at('2026-10-24T10:00:00'), model_name: 'c', quota: 1 },
        { created_at: at('2026-10-12T10:00:00'), model_name: 'a', quota: 9 },
      ],
      window,
      ['a', 'b']
    )
    expect(stack[0]).toEqual([4, 2, 0])
    expect(stack[6]).toEqual([0, 0, 1])
  })
})

describe('rankModelsByCount', () => {
  it('orders by calls and folds the rest', () => {
    const ranking = rankModelsByCount(
      [
        { modelName: 'a', quota: 9, count: 1 },
        { modelName: 'b', quota: 1, count: 5 },
        { modelName: 'c', quota: 1, count: 2 },
      ],
      1
    )
    expect(ranking.items.map((model) => model.modelName)).toEqual(['b'])
    expect(ranking.otherCount).toBe(2)
    expect(ranking.other).toBe(3)
  })
})

describe('getPeakHour', () => {
  it('sums every model per hour and returns the busiest one', () => {
    const window = buildBoardWindow('today', now)
    const peak = getPeakHour(
      [
        { created_at: at('2026-10-24T09:00:00'), model_name: 'a', count: 3 },
        { created_at: at('2026-10-24T09:00:00'), model_name: 'b', count: 4 },
        { created_at: at('2026-10-24T11:00:00'), model_name: 'a', count: 5 },
      ],
      window
    )
    expect(peak).toEqual({ start: at('2026-10-24T09:00:00'), count: 7 })
  })

  it('returns null without traffic', () => {
    expect(getPeakHour([], buildBoardWindow('today', now))).toBeNull()
  })
})
