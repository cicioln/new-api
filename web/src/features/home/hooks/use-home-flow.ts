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

import type { PricingData } from '@/features/pricing/types'
import { api } from '@/lib/api'

/** Window used by the public group summary (`/api/home/groups`). */
export const HOME_FLOW_HOURS = 1
export const HOME_FLOW_MAX_GROUPS = 8

export type HomeFlowGroup = {
  group: string
  desc: string
  ratio: number
  /** Model names enabled for the group, from pricing */
  models: string[]
  modelTotal: number
  /** null when the group has no measured traffic in the window */
  successRate: number | null
  avgLatencyMs: number | null
  avgTps: number | null
}

export type HomeFlowStatus = 'loading' | 'error' | 'empty' | 'ready'

export type HomeFlowData = {
  groups: HomeFlowGroup[]
  totalGroups: number
  status: HomeFlowStatus
  /** True when no group in the window has measured traffic */
  noPerf: boolean
  refetch: () => void
}

type HomeGroupsResponse = {
  success: boolean
  message?: string
  data?: {
    window_start: number
    window_end: number
    groups: {
      group: string
      desc: string
      ratio: number
      model_count: number
      success_rate: number | null
      avg_latency_ms: number | null
      avg_tps?: number | null
    }[]
  }
}

async function fetchHomeGroups() {
  const res = await api.get<HomeGroupsResponse>('/api/home/groups', {
    params: { hours: HOME_FLOW_HOURS },
    skipErrorHandler: true,
  })
  if (!res.data?.success || !res.data.data) {
    throw new Error(res.data?.message || 'Failed to load groups')
  }
  return res.data.data.groups
}

async function fetchPricing(): Promise<PricingData | null> {
  const res = await api.get<PricingData>('/api/pricing', {
    skipErrorHandler: true,
  })
  return res.data?.success ? res.data : null
}

export function useHomeFlow(): HomeFlowData {
  const groupsQuery = useQuery({
    queryKey: ['home-flow', 'groups', HOME_FLOW_HOURS],
    queryFn: fetchHomeGroups,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  })
  // Pricing only supplies sample model names for each group label.
  const pricingQuery = useQuery({
    queryKey: ['home-flow', 'pricing'],
    queryFn: fetchPricing,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const refetch = groupsQuery.refetch

  return useMemo(() => {
    const raw = groupsQuery.data ?? []
    const namesByGroup = new Map<string, string[]>()
    for (const model of pricingQuery.data?.data ?? []) {
      for (const group of model.enable_groups ?? []) {
        const list = namesByGroup.get(group) ?? []
        list.push(model.model_name)
        namesByGroup.set(group, list)
      }
    }
    const allNames = namesByGroup.get('all') ?? []

    const groups: HomeFlowGroup[] = raw.map((g) => ({
      group: g.group,
      desc: g.desc,
      ratio: g.ratio,
      models: [...new Set([...(namesByGroup.get(g.group) ?? []), ...allNames])],
      modelTotal: g.model_count,
      successRate: g.success_rate,
      avgLatencyMs: g.avg_latency_ms,
      avgTps: g.avg_tps ?? null,
    }))

    let status: HomeFlowStatus = 'ready'
    if (groupsQuery.isLoading) status = 'loading'
    else if (groupsQuery.isError) status = 'error'
    else if (groups.length === 0) status = 'empty'

    return {
      groups: groups.slice(0, HOME_FLOW_MAX_GROUPS),
      totalGroups: groups.length,
      status,
      noPerf: groups.every((g) => g.successRate === null),
      refetch: () => {
        void refetch()
      },
    }
  }, [
    groupsQuery.data,
    groupsQuery.isLoading,
    groupsQuery.isError,
    pricingQuery.data,
    refetch,
  ])
}
