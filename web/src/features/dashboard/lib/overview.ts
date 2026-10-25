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

/** Fixed palette for the top models; the second bar follows the ink color. */
export const MODEL_BAR_CLASSES = [
  'bg-[#D97757]',
  'bg-foreground',
  'bg-[#4285F4]',
  'bg-[#4D6BFE]',
  'bg-[#615CED]',
]
export const OTHER_BAR_CLASS = 'bg-[#B9B6AD] dark:bg-[#5A5D66]'

export type OverviewPeriod = '24h' | '7d' | '30d'

export const OVERVIEW_PERIODS: Record<
  OverviewPeriod,
  {
    labelKey: string
    /** Name of the period before, used inside the header sentence. */
    previousKey: string
    /** Comparison suffix shown after a KPI change. */
    compareKey: string
    bucket: 'hour' | 'day'
    /** Units per bucket, e.g. 12 hours for the half-day buckets of 7 days. */
    bucketSize: number
    buckets: number
  }
> = {
  '24h': {
    labelKey: '24 hours',
    previousKey: 'yesterday',
    compareKey: 'vs yesterday',
    bucket: 'hour',
    bucketSize: 1,
    buckets: 24,
  },
  '7d': {
    labelKey: '7 days',
    previousKey: 'last week',
    compareKey: 'vs last week',
    bucket: 'hour',
    bucketSize: 12,
    buckets: 14,
  },
  '30d': {
    labelKey: '30 days',
    previousKey: 'last month',
    compareKey: 'vs last month',
    bucket: 'day',
    bucketSize: 1,
    buckets: 30,
  },
}

export const OVERVIEW_PERIOD_IDS = Object.keys(
  OVERVIEW_PERIODS
) as OverviewPeriod[]

export interface OverviewWindow {
  /** Start of the previous period of the same length (seconds). */
  previousStart: number
  /** Start of the current period (seconds). */
  start: number
  /** End of the current period (seconds). */
  end: number
  /** Start timestamp of every bucket in the current period (seconds). */
  bucketStarts: number[]
}

export interface OverviewTotals {
  count: number
  quota: number
  tokens: number
}

export interface OverviewModelUsage {
  modelName: string
  quota: number
  count: number
}

export interface OverviewAggregate {
  current: OverviewTotals
  previous: OverviewTotals
  series: { count: number[]; quota: number[]; tokens: number[] }
  /** Models in the current period, ordered by spend. */
  models: OverviewModelUsage[]
}

/**
 * Hourly buckets for the last 24 hours, half days for 7 days and local
 * calendar days for 30 days, each ending with the bucket that holds now.
 * The previous period has the same number of buckets right before.
 */
export function buildOverviewWindow(
  period: OverviewPeriod,
  nowSeconds: number
): OverviewWindow {
  const config = OVERVIEW_PERIODS[period]
  const hour = dayjs(nowSeconds * 1000).startOf(config.bucket)
  const last =
    config.bucket === 'hour'
      ? hour.subtract(hour.hour() % config.bucketSize, 'hour')
      : hour
  const span = config.buckets * config.bucketSize
  const first = last.subtract(span - config.bucketSize, config.bucket)
  const bucketStarts = Array.from({ length: config.buckets }, (_, index) =>
    first.add(index * config.bucketSize, config.bucket).unix()
  )

  return {
    previousStart: first.subtract(span, config.bucket).unix(),
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

export function aggregateOverview(
  rows: QuotaDataItem[],
  window: OverviewWindow
): OverviewAggregate {
  const size = window.bucketStarts.length
  const current: OverviewTotals = { count: 0, quota: 0, tokens: 0 }
  const previous: OverviewTotals = { count: 0, quota: 0, tokens: 0 }
  const series = {
    count: Array.from({ length: size }, () => 0),
    quota: Array.from({ length: size }, () => 0),
    tokens: Array.from({ length: size }, () => 0),
  }
  const models = new Map<string, OverviewModelUsage>()

  for (const row of rows) {
    const timestamp = Number(row.created_at) || 0
    const count = Number(row.count) || 0
    const quota = Number(row.quota) || 0
    const tokens = Number(row.token_used) || 0
    if (timestamp < window.previousStart || timestamp > window.end) continue

    if (timestamp < window.start) {
      previous.count += count
      previous.quota += quota
      previous.tokens += tokens
      continue
    }

    current.count += count
    current.quota += quota
    current.tokens += tokens
    const bucket = findBucket(window.bucketStarts, timestamp)
    if (bucket >= 0) {
      series.count[bucket] += count
      series.quota[bucket] += quota
      series.tokens[bucket] += tokens
    }

    const modelName = row.model_name || '-'
    const model = models.get(modelName) ?? { modelName, quota: 0, count: 0 }
    model.quota += quota
    model.count += count
    models.set(modelName, model)
  }

  return {
    current,
    previous,
    series,
    models: [...models.values()].sort(
      (a, b) => b.quota - a.quota || b.count - a.count
    ),
  }
}

/** Count timestamps (seconds) into the buckets of the current period. */
export function countByBucket(
  timestamps: number[],
  window: OverviewWindow
): number[] {
  const counts = window.bucketStarts.map(() => 0)
  for (const timestamp of timestamps) {
    if (timestamp < window.start || timestamp > window.end) continue
    const bucket = findBucket(window.bucketStarts, timestamp)
    if (bucket >= 0) counts[bucket] += 1
  }
  return counts
}

/** Share of successful calls in percent, or null when nothing was called. */
export function getSuccessRate(
  succeeded: number,
  failed: number
): number | null {
  const total = succeeded + failed
  if (total <= 0) return null
  return (succeeded / total) * 100
}

/** Percentage change from the previous period, or null without a baseline. */
export function getPeriodChange(
  current: number,
  previous: number
): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * Keep the top models and fold the rest into one entry, so the share list
 * always adds up to the period total.
 */
export function foldModelShare(
  models: OverviewModelUsage[],
  limit: number
): { items: OverviewModelUsage[]; otherCount: number; other: number } {
  const items = models.slice(0, limit)
  const rest = models.slice(limit)
  return {
    items,
    otherCount: rest.length,
    other: rest.reduce((total, model) => total + model.quota, 0),
  }
}

export function getGreetingKey(hour: number): string {
  if (hour < 5) return 'Good evening, {{name}}'
  if (hour < 12) return 'Good morning, {{name}}'
  if (hour < 18) return 'Good afternoon, {{name}}'
  return 'Good evening, {{name}}'
}
