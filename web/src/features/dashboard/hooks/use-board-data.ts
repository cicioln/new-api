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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getUserQuotaDates } from '@/features/dashboard/api'
import {
  buildBoardWindow,
  type BoardPeriod,
} from '@/features/dashboard/lib/board'
import { aggregateOverview } from '@/features/dashboard/lib/overview'
import { requireServerSuccess } from '@/lib/server-error-message'

export interface BoardFilters {
  modelName: string
  username: string
}

export const EMPTY_BOARD_FILTERS: BoardFilters = { modelName: '', username: '' }

/**
 * Usage of the selected period and the one before it. Administrators see
 * every user through /api/data; others see their own usage.
 */
export function useBoardUsage(
  period: BoardPeriod,
  filters: BoardFilters,
  isAdmin: boolean
) {
  // Recompute the window only when the period changes, so the query key is stable.
  const window = useMemo(
    () => buildBoardWindow(period, Math.floor(Date.now() / 1000)),
    [period]
  )
  const username = isAdmin ? filters.username.trim() : ''

  const query = useQuery({
    queryKey: ['dashboard', 'board', period, window.start, isAdmin, username],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates(
          {
            start_timestamp: window.previousStart,
            end_timestamp: window.end,
            default_time: period === 'today' ? 'hour' : 'day',
            ...(username && { username }),
          },
          isAdmin
        )
      ),
    staleTime: 60 * 1000,
  })

  const modelName = filters.modelName.trim().toLowerCase()
  const rows = useMemo(() => {
    const data = query.data?.data ?? []
    if (!modelName) return data
    return data.filter((row) =>
      (row.model_name ?? '').toLowerCase().includes(modelName)
    )
  }, [query.data, modelName])

  const aggregate = useMemo(
    () => aggregateOverview(rows, window),
    [rows, window]
  )

  return { window, rows, aggregate, loading: query.isLoading }
}
