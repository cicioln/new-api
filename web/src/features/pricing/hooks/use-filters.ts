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
import { useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'

import { useDebounce } from '@/hooks/use-debounce'

import { DEFAULT_TOKEN_UNIT, VIEW_MODES, type ViewMode } from '../constants'
import {
  filterMarketModels,
  MARKET_SORTS,
  type MarketPerf,
  type MarketSort,
  type MarketStatusFilter,
} from '../lib/market'
import type { PricingModel, TokenUnit } from '../types'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

export function useFilters(
  models: PricingModel[],
  perf: Map<string, MarketPerf>,
  defaultGroup: string | undefined
) {
  const search = useSearch({ from: '/pricing/' })
  const [searchInput, setSearchInput] = useState(search.search ?? '')
  const [vendors, setVendors] = useState<string[]>(
    search.vendor ? [search.vendor] : []
  )
  const [status, setStatus] = useState<MarketStatusFilter | undefined>()
  const [selectedGroup, setGroup] = useState<string | undefined>(search.group)
  const [sortBy, setSortBy] = useState<MarketSort>(
    MARKET_SORTS.find((sort) => sort === search.sort) ?? 'hot'
  )
  const [viewMode, setViewMode] = useState<ViewMode>(
    search.view === VIEW_MODES.TABLE ? VIEW_MODES.TABLE : VIEW_MODES.CARD
  )
  const [tokenUnit, setTokenUnit] = useState<TokenUnit>(
    search.tokenUnit === 'K' ? 'K' : DEFAULT_TOKEN_UNIT
  )
  const [showRechargePrice, setShowRechargePrice] = useState(
    search.rechargePrice === true
  )
  const debouncedSearch = useDebounce(searchInput, 200)
  const group = selectedGroup ?? defaultGroup

  const toggleVendor = useCallback(
    (vendor: string) => setVendors((prev) => toggle(prev, vendor)),
    []
  )
  const toggleStatus = useCallback(
    (next: MarketStatusFilter) =>
      setStatus((prev) => (prev === next ? undefined : next)),
    []
  )
  const clearStatus = useCallback(() => setStatus(undefined), [])
  const clearVendors = useCallback(() => setVendors([]), [])
  const resetGroup = useCallback(() => setGroup(undefined), [])
  const clearSearch = useCallback(() => setSearchInput(''), [])
  const clearAll = useCallback(() => {
    setSearchInput('')
    setVendors([])
    setStatus(undefined)
    setGroup(undefined)
  }, [])

  const filteredModels = useMemo(
    () =>
      filterMarketModels(models, {
        search: debouncedSearch,
        vendors,
        status,
        group,
        sort: sortBy,
        perf,
      }),
    [models, debouncedSearch, vendors, status, group, sortBy, perf]
  )

  return {
    searchInput,
    vendors,
    status,
    group,
    isDefaultGroup: group === defaultGroup,
    sortBy,
    viewMode,
    tokenUnit,
    showRechargePrice,
    setSearchInput,
    toggleVendor,
    clearVendors,
    toggleStatus,
    clearStatus,
    setGroup,
    resetGroup,
    setSortBy,
    setViewMode,
    setTokenUnit,
    setShowRechargePrice,
    clearSearch,
    clearAll,
    filteredModels,
  }
}
