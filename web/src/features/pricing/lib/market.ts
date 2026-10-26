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
import type { SuccessRatePoint } from '@/features/performance-metrics/types'

import { EXCLUDED_GROUPS } from '../constants'
import type { PricingModel } from '../types'
import { filterBySearch, getSortPrice } from './filters'

// ----------------------------------------------------------------------------
// Model market helpers
// ----------------------------------------------------------------------------

export const MARKET_SORTS = ['hot', 'price', 'new'] as const
export type MarketSort = (typeof MARKET_SORTS)[number]

export const MARKET_STATUSES = ['ok', 'warn', 'bad'] as const
export type MarketStatus = (typeof MARKET_STATUSES)[number]

/** Status filter options; `none` matches models without perf data. */
export const MARKET_STATUS_FILTERS = [...MARKET_STATUSES, 'none'] as const
export type MarketStatusFilter = (typeof MARKET_STATUS_FILTERS)[number]

/** Number of status bars shown for the last 24 hours. */
export const STATUS_BAR_COUNT = 24

const STATUS_OK_MIN = 99
const STATUS_WARN_MIN = 90

export type MarketPerf = {
  latencyMs?: number
  tps?: number
  successRate?: number
  requests: number
  series: SuccessRatePoint[]
}

function finite(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

export function toMarketPerf(summary: {
  avg_latency_ms: number
  avg_tps: number
  success_rate: number
  request_count?: number
  recent_success_series?: SuccessRatePoint[]
}): MarketPerf {
  const rate = summary.success_rate
  return {
    latencyMs: finite(summary.avg_latency_ms),
    tps: finite(summary.avg_tps),
    successRate:
      Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : undefined,
    requests: summary.request_count ?? 0,
    series: summary.recent_success_series ?? [],
  }
}

const STATUS_LABEL_KEYS: Record<MarketStatusFilter, string> = {
  ok: 'Normal',
  warn: 'Busy',
  bad: 'Under maintenance',
  none: 'No data',
}

export function getStatusLabelKey(status: MarketStatusFilter): string {
  return STATUS_LABEL_KEYS[status]
}

export function getStatusLevel(rate: number | undefined): MarketStatus | null {
  if (rate == null || !Number.isFinite(rate)) return null
  if (rate >= STATUS_OK_MIN) return 'ok'
  if (rate >= STATUS_WARN_MIN) return 'warn'
  return 'bad'
}

/**
 * Latest valid success samples in chronological order, padded on the left
 * with `null` so the strip always has {@link STATUS_BAR_COUNT} slots.
 */
export function getStatusBars(
  series: SuccessRatePoint[] | undefined
): (MarketStatus | null)[] {
  const samples = (series ?? [])
    .filter(
      (point) =>
        Number.isFinite(point.ts) &&
        Number.isFinite(point.success_rate) &&
        point.success_rate >= 0 &&
        point.success_rate <= 100
    )
    .sort((a, b) => a.ts - b.ts)
    .slice(-STATUS_BAR_COUNT)
    .map((point) => getStatusLevel(point.success_rate))
  return [
    ...Array.from<null>({ length: STATUS_BAR_COUNT - samples.length }).fill(
      null
    ),
    ...samples,
  ]
}

export function formatMarketLatency(ms: number | undefined): string {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

export function formatMarketTps(tps: number | undefined): string {
  return tps == null ? '—' : String(Math.round(tps))
}

export function formatSuccessRate(rate: number | undefined): string {
  return rate == null ? '—' : `${rate.toFixed(2)}%`
}

const VENDOR_COLORS: Record<string, string> = {
  Anthropic: '#D97757',
  OpenAI: '#111214',
  Google: '#4285F4',
  DeepSeek: '#4D6BFE',
  通义千问: '#615CED',
  Alibaba: '#615CED',
  Qwen: '#615CED',
  xAI: '#1F2937',
  Meta: '#1877F2',
  Moonshot: '#EC4899',
  Zhipu: '#06B6D4',
  Mistral: '#FF7000',
  ByteDance: '#3B82F6',
  Tencent: '#22C55E',
  MiniMax: '#A855F7',
}

const FALLBACK_COLORS = [
  '#0EA5E9',
  '#22C55E',
  '#A855F7',
  '#F97316',
  '#14B8A6',
  '#EAB308',
  '#EC4899',
  '#6366F1',
]

/** Avatar name for a model: its vendor, or the model itself when unknown. */
export function getVendorAvatarName(model: PricingModel): string {
  return model.vendor_name || model.model_name || '?'
}

/** Vendor icon for the avatar, falling back to the model's own icon. */
export function getVendorAvatarIcon(model: PricingModel): string | undefined {
  return model.vendor_icon || model.icon || undefined
}

/** Avatar color and letter for a vendor name, stable across renders. */
export function getVendorAvatar(vendorName: string): {
  color: string
  letter: string
} {
  const name = vendorName || '?'
  let color = VENDOR_COLORS[name]
  if (!color) {
    let hash = 0
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
    color = FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
  }
  return { color, letter: name.charAt(0).toUpperCase() }
}

/**
 * Groups a viewer can price against, in configured order. A group removed
 * from group pricing is hidden even though the viewer's own group stays
 * usable, matching the backend rule for selectable groups.
 */
export function getMarketGroups(
  usableGroup: Record<string, { desc: string; ratio: number }>,
  groupRatio: Record<string, number>
): string[] {
  return Object.keys(usableGroup).filter(
    (g) => !EXCLUDED_GROUPS.includes(g) && Object.hasOwn(groupRatio, g)
  )
}

export function getDefaultMarketGroup(groups: string[]): string | undefined {
  return groups.includes('default') ? 'default' : groups[0]
}

const CHAT_ENDPOINTS = new Set([
  'openai',
  'openai-response',
  'anthropic',
  'gemini',
])

/** Whether the model can answer a chat prompt for the pelican test. */
export function supportsPelicanTest(model: PricingModel): boolean {
  const endpoints = model.supported_endpoint_types ?? []
  if (endpoints.length === 0) return true
  return endpoints.some((endpoint) => CHAT_ENDPOINTS.has(endpoint))
}

export type MarketFilterOptions = {
  search: string
  vendors: string[]
  status?: MarketStatusFilter
  group?: string
  sort: MarketSort
  perf: Map<string, MarketPerf>
}

function getMarketSortPrice(model: PricingModel): number | undefined {
  return getSortPrice(model, 'input') ?? getSortPrice(model, 'request')
}

export function filterMarketModels(
  models: PricingModel[],
  options: MarketFilterOptions
): PricingModel[] {
  const result = filterBySearch(models, options.search.trim()).filter(
    (model) => {
      if (
        options.vendors.length > 0 &&
        !options.vendors.includes(model.vendor_name ?? '')
      ) {
        return false
      }
      if (options.status) {
        const status =
          getStatusLevel(options.perf.get(model.model_name)?.successRate) ??
          'none'
        if (status !== options.status) return false
      }
      return !options.group || model.enable_groups?.includes(options.group)
    }
  )

  const order = new Map(models.map((model, index) => [model, index]))
  const byOrder = (a: PricingModel, b: PricingModel) =>
    (order.get(a) ?? 0) - (order.get(b) ?? 0)

  if (options.sort === 'price') {
    const price = new Map(result.map((m) => [m, getMarketSortPrice(m)]))
    return result.sort((a, b) => {
      const priceA = price.get(a)
      const priceB = price.get(b)
      if (priceA === undefined || priceB === undefined) {
        return (
          Number(priceA === undefined) - Number(priceB === undefined) ||
          byOrder(a, b)
        )
      }
      return priceA - priceB || byOrder(a, b)
    })
  }
  if (options.sort === 'new') {
    return result.sort(
      (a, b) =>
        (b.release_date ?? '').localeCompare(a.release_date ?? '') ||
        (b.id ?? 0) - (a.id ?? 0)
    )
  }
  return result.sort(
    (a, b) =>
      (options.perf.get(b.model_name)?.requests ?? 0) -
        (options.perf.get(a.model_name)?.requests ?? 0) || byOrder(a, b)
  )
}
