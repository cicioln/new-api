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
import type { QuotaDataItem } from '@/features/dashboard/types'
import dayjs from '@/lib/dayjs'

import type { OverviewModelUsage, OverviewWindow } from './overview'

export type BoardPeriod = 'today' | '7d' | '30d'

export const BOARD_PERIODS: Record<
  BoardPeriod,
  {
    labelKey: string
    /** Comparison suffix shown after a KPI change. */
    compareKey: string
    bucket: 'hour' | 'day'
    buckets: number
  }
> = {
  today: {
    labelKey: 'Today',
    compareKey: 'vs yesterday',
    bucket: 'hour',
    buckets: 24,
  },
  '7d': {
    labelKey: '7 days',
    compareKey: 'vs last week',
    bucket: 'day',
    buckets: 7,
  },
  '30d': {
    labelKey: '30 days',
    compareKey: 'vs last month',
    bucket: 'day',
    buckets: 30,
  },
}

export const BOARD_PERIOD_IDS = Object.keys(BOARD_PERIODS) as BoardPeriod[]

/**
 * Hourly buckets for the current calendar day, or local calendar days ending
 * today. The previous period has the same length right before.
 */
export function buildBoardWindow(
  period: BoardPeriod,
  nowSeconds: number
): OverviewWindow {
  const config = BOARD_PERIODS[period]
  const today = dayjs(nowSeconds * 1000).startOf('day')
  const first =
    config.bucket === 'hour' ? today : today.subtract(config.buckets - 1, 'day')
  const bucketStarts = Array.from({ length: config.buckets }, (_, index) =>
    first.add(index, config.bucket).unix()
  )
  const span = config.bucket === 'hour' ? 1 : config.buckets

  return {
    previousStart: first.subtract(span, 'day').unix(),
    start: first.unix(),
    end: nowSeconds,
    bucketStarts,
  }
}

function findBucket(bucketStarts: number[], timestamp: number): number {
  for (let index = bucketStarts.length - 1; index >= 0; index--) {
    if (timestamp >= bucketStarts[index]) return index
  }
  return -1
}

/**
 * Spend per bucket for each of the given models, plus a last column for every
 * other model, so each bar adds up to the bucket total.
 */
export function stackByModel(
  rows: QuotaDataItem[],
  window: OverviewWindow,
  modelNames: string[]
): number[][] {
  const stack = window.bucketStarts.map(() =>
    Array.from({ length: modelNames.length + 1 }, () => 0)
  )
  for (const row of rows) {
    const timestamp = Number(row.created_at) || 0
    if (timestamp < window.start || timestamp > window.end) continue
    const bucket = findBucket(window.bucketStarts, timestamp)
    if (bucket < 0) continue
    const index = modelNames.indexOf(row.model_name || '-')
    const column = index >= 0 ? index : modelNames.length
    stack[bucket][column] += Number(row.quota) || 0
  }
  return stack
}

/** Keep the most called models and fold the rest into one remainder. */
export function rankModelsByCount(
  models: OverviewModelUsage[],
  limit: number
): { items: OverviewModelUsage[]; otherCount: number; other: number } {
  const sorted = [...models].sort(
    (a, b) => b.count - a.count || b.quota - a.quota
  )
  const rest = sorted.slice(limit)
  return {
    items: sorted.slice(0, limit),
    otherCount: rest.length,
    other: rest.reduce((total, model) => total + model.count, 0),
  }
}

/** The busiest hour of the current period, or null without traffic. */
export function getPeakHour(
  rows: QuotaDataItem[],
  window: OverviewWindow
): { start: number; count: number } | null {
  const hours = new Map<number, number>()
  for (const row of rows) {
    const timestamp = Number(row.created_at) || 0
    if (timestamp < window.start || timestamp > window.end) continue
    const hour = timestamp - (timestamp % 3600)
    hours.set(hour, (hours.get(hour) ?? 0) + (Number(row.count) || 0))
  }
  let peak: { start: number; count: number } | null = null
  for (const [start, count] of hours) {
    if (count > 0 && (peak === null || count > peak.count)) {
      peak = { start, count }
    }
  }
  return peak
}
