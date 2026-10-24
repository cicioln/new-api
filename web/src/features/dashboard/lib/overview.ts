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

export type OverviewPeriod = '24h' | '7d' | '30d'

export const OVERVIEW_PERIODS: Record<
  OverviewPeriod,
  { labelKey: string; bucket: 'hour' | 'day'; buckets: number }
> = {
  '24h': { labelKey: '24 hours', bucket: 'hour', buckets: 24 },
  '7d': { labelKey: '7 days', bucket: 'day', buckets: 7 },
  '30d': { labelKey: '30 days', bucket: 'day', buckets: 30 },
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
 * Hourly buckets for the last 24 hours, otherwise local calendar days ending
 * today. The previous period has the same number of buckets right before.
 */
export function buildOverviewWindow(
  period: OverviewPeriod,
  nowSeconds: number
): OverviewWindow {
  const config = OVERVIEW_PERIODS[period]
  const last = dayjs(nowSeconds * 1000).startOf(config.bucket)
  const first = last.subtract(config.buckets - 1, config.bucket)
  const bucketStarts = Array.from({ length: config.buckets }, (_, index) =>
    first.add(index, config.bucket).unix()
  )

  return {
    previousStart: first.subtract(config.buckets, config.bucket).unix(),
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
