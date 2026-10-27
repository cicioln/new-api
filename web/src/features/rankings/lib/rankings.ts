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
import type { ModelRanking, RankingMover, RankingPeriod } from '../types'

export const RANKING_PERIODS: { value: RankingPeriod; labelKey: string }[] = [
  { value: 'today', labelKey: 'Today' },
  { value: 'week', labelKey: 'This week' },
  { value: 'month', labelKey: 'Current month' },
  { value: 'year', labelKey: 'Ranking period this year' },
]

export type RankChange =
  | { kind: 'new' }
  | { kind: 'same' }
  | { kind: 'up' | 'down'; delta: number }

/** Rank movement versus the previous period; no previous rank means new. */
export function getRankChange(row: ModelRanking): RankChange {
  if (row.previous_rank == null) return { kind: 'new' }
  const delta = row.previous_rank - row.rank
  if (delta > 0) return { kind: 'up', delta }
  if (delta < 0) return { kind: 'down', delta: -delta }
  return { kind: 'same' }
}

/** Fastest climbers shown in the side card. */
export function getTopRisers(movers: RankingMover[], limit = 4) {
  return movers.filter((row) => row.rank_delta > 0).slice(0, limit)
}
