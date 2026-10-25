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

import type { ModelRanking, RankingMover } from '../../types'
import { filterRankingCategory, getRankChange, getTopRisers } from '../rankings'

function row(overrides: Partial<ModelRanking> = {}): ModelRanking {
  return {
    rank: 3,
    previous_rank: 3,
    model_name: 'gpt-5.2',
    vendor: 'OpenAI',
    category: 'all',
    total_tokens: 1000,
    share: 0.1,
    growth_pct: 0,
    ...overrides,
  }
}

function mover(model_name: string, rank_delta: number): RankingMover {
  return {
    model_name,
    vendor: 'OpenAI',
    rank_delta,
    current_rank: 1,
    growth_pct: 0,
  }
}

describe('rankings helpers', () => {
  it('reports a model without a previous rank as new', () => {
    expect(getRankChange(row({ previous_rank: undefined }))).toEqual({
      kind: 'new',
    })
  })

  it('reports climbs, drops and unchanged ranks with their size', () => {
    expect(getRankChange(row({ rank: 1, previous_rank: 3 }))).toEqual({
      kind: 'up',
      delta: 2,
    })
    expect(getRankChange(row({ rank: 4, previous_rank: 3 }))).toEqual({
      kind: 'down',
      delta: 1,
    })
    expect(getRankChange(row())).toEqual({ kind: 'same' })
  })

  it('keeps every row for the all category and filters the others', () => {
    const rows = [
      row({ model_name: 'a', category: 'programming' }),
      row({ model_name: 'b', category: 'roleplay' }),
    ]
    expect(filterRankingCategory(rows, 'all')).toHaveLength(2)
    expect(
      filterRankingCategory(rows, 'roleplay').map((r) => r.model_name)
    ).toEqual(['b'])
  })

  it('lists at most four climbers and drops non-positive deltas', () => {
    const movers = [
      mover('a', 5),
      mover('b', 3),
      mover('c', 2),
      mover('d', 1),
      mover('e', 1),
      mover('f', 0),
    ]
    expect(getTopRisers(movers).map((m) => m.model_name)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })
})
