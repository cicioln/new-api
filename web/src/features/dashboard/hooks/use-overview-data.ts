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
  aggregateOverview,
  buildOverviewWindow,
  type OverviewPeriod,
} from '@/features/dashboard/lib/overview'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { requireServerSuccess } from '@/lib/server-error-message'

const PERIOD_HOURS: Record<OverviewPeriod, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

/** Personal usage for the selected period and the one before it. */
export function useOverviewUsage(period: OverviewPeriod) {
  // Recompute the window only when the period changes, so the query key is stable.
  const window = useMemo(
    () => buildOverviewWindow(period, Math.floor(Date.now() / 1000)),
    [period]
  )

  const query = useQuery({
    queryKey: ['dashboard', 'overview', 'usage', period, window.start],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: window.previousStart,
          end_timestamp: window.end,
          default_time: OVERVIEW_DEFAULT_TIME[period],
        })
      ),
    staleTime: 60 * 1000,
  })

  const aggregate = useMemo(
    () => aggregateOverview(query.data?.data ?? [], window),
    [query.data, window]
  )

  return {
    window,
    aggregate,
    loading: query.isLoading,
    error: query.isError,
  }
}

const OVERVIEW_DEFAULT_TIME: Record<OverviewPeriod, string> = {
  '24h': 'hour',
  '7d': 'day',
  '30d': 'day',
}

/** Server-side request performance; shares its cache with other summary views. */
export function usePerfSummary(hours: number) {
  return useQuery({
    queryKey: ['perf-metrics-summary', hours],
    queryFn: async () =>
      requireServerSuccess(await getPerfMetricsSummary(hours)),
    staleTime: 60 * 1000,
    retry: false,
  })
}

export function getPeriodHours(period: OverviewPeriod): number {
  return PERIOD_HOURS[period]
}
